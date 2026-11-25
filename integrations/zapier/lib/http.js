'use strict';

// Tests and local scripts may point at another server; the pushed app never sets this.
const BASE_URL = process.env.ISHORTN_API_BASE || 'https://ishortn.ink/api/v1';

const AUTH_ERROR_MESSAGE =
  'Your iShortn API key is invalid or was deleted. Reconnect your iShortn account with a new key from Settings → API Keys.';
const PLAN_ERROR_MESSAGE =
  'The iShortn API needs a Pro or Ultra plan. Upgrade at https://ishortn.ink/pricing and try again.';
const DEFAULT_RETRY_SECONDS = 60;

const includeApiKey = (request, z, bundle) => {
  request.headers = request.headers || {};
  request.headers['x-api-key'] = bundle.authData.api_key;
  request.headers.Accept = 'application/json';
  const hasContentType = Object.keys(request.headers).some(
    (name) => name.toLowerCase() === 'content-type',
  );
  // Core already sets a JSON content type for object bodies; don't send two.
  if (request.body !== undefined && request.body !== null && !hasContentType) {
    request.headers['Content-Type'] = 'application/json';
  }
  // Errors are mapped below. Core would otherwise throw its own generic errors,
  // and throw 429s before afterResponse with only Retry-After for the delay.
  request.skipThrowForStatus = true;
  request.throwForThrottlingEarly = false;
  return request;
};

const parseJson = (response) => {
  try {
    return JSON.parse(response.content);
  } catch {
    return null;
  }
};

const retryAfterSeconds = (response) => {
  const retryAfter = parseInt(response.headers.get('retry-after'), 10);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter;
  const reset = parseInt(response.headers.get('x-ratelimit-reset'), 10);
  if (Number.isFinite(reset)) {
    const seconds = reset - Math.floor(Date.now() / 1000);
    if (seconds > 0) return seconds;
  }
  return DEFAULT_RETRY_SECONDS;
};

const handleErrors = (response, z) => {
  const { status } = response;
  if (status < 400) return response;
  // Searches treat a missing link as "no match"; they opt in per request.
  if (status === 404 && response.request && response.request.allowNotFound) return response;

  const body = parseJson(response);
  const error = body && typeof body.error === 'object' ? body.error : null;

  if (status === 401) throw new z.errors.RefreshAuthError(AUTH_ERROR_MESSAGE);
  if (status === 403 && body && body.upgrade_url) {
    throw new z.errors.Error(PLAN_ERROR_MESSAGE, 'PlanRequired', 403);
  }
  if (status === 429) {
    const message = (error && error.message) || 'iShortn rate limit reached.';
    throw new z.errors.ThrottledError(message, retryAfterSeconds(response));
  }
  if (status >= 500) {
    throw new z.errors.Error(
      `iShortn returned an error (status ${status}). Try again in a minute.`,
      'ServerError',
      status,
    );
  }
  if (error && error.message) {
    const details = Array.isArray(error.details) ? error.details : [];
    const lines = details.map((detail) =>
      detail.path ? `${detail.path}: ${detail.message}` : detail.message,
    );
    throw new z.errors.Error(
      [error.message, ...lines].join('\n'),
      error.code || 'BadRequest',
      status,
    );
  }
  throw new z.errors.Error(
    `iShortn rejected the request (status ${status}).`,
    'BadRequest',
    status,
  );
};

const trimmed = (value) => (typeof value === 'string' ? value.trim() : value);

const isFilled = (value) => value !== undefined && value !== null && trimmed(value) !== '';

/** Query params for a link's domain; empty means the account's default domain. */
const domainParams = (domain) => (isFilled(domain) ? { domain: trimmed(domain) } : {});

const aliasPath = (alias) => encodeURIComponent(alias.trim());

const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

/** Minutes `timeZone` is ahead of UTC at the instant `utcMs`. */
const zoneOffsetMinutes = (utcMs, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
};

/**
 * The API needs ISO 8601 with an offset. Zapier datetime fields normally arrive
 * that way; a value without one is read in the Zap's timezone, or as UTC.
 */
const toIsoDateTime = (value, timeZone) => {
  const text = trimmed(String(value));
  if (HAS_OFFSET.test(text)) return text;
  const match = NAIVE_DATETIME.exec(text);
  if (!match) return text;
  const [, year, month, day, hour = '0', minute = '0', second = '0', ms = '0'] = match;
  const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +ms.padEnd(3, '0'));
  let offset = 0;
  if (timeZone) {
    try {
      offset = zoneOffsetMinutes(wallClock, timeZone);
      // Re-check at the corrected instant so times near a DST change land right.
      offset = zoneOffsetMinutes(wallClock - offset * 60000, timeZone);
    } catch {
      offset = 0;
    }
  }
  return new Date(wallClock - offset * 60000).toISOString();
};

module.exports = {
  BASE_URL,
  includeApiKey,
  handleErrors,
  domainParams,
  aliasPath,
  isFilled,
  trimmed,
  toIsoDateTime,
};
