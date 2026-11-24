'use strict';

const ALIAS_PATTERN = /^[A-Za-z0-9_-]+$/;
// A hostname with at least one dot, such as isht.app or go.example.com.
const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/i;

/**
 * Reads a link reference: a full short link (`https://isht.app/launch-day`),
 * `domain/alias`, or a bare alias, which uses `domainField` (empty means the
 * account's default domain).
 */
const parseLinkRef = (z, value, domainField) => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  const reference = raw
    .replace(/^https?:\/\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  const parts = reference.split('/');

  if (parts.length === 1 && ALIAS_PATTERN.test(parts[0])) {
    const domain = typeof domainField === 'string' ? domainField.trim() : '';
    return { domain: domain || undefined, alias: parts[0] };
  }
  if (parts.length === 2 && DOMAIN_PATTERN.test(parts[0]) && ALIAS_PATTERN.test(parts[1])) {
    return { domain: parts[0].toLowerCase(), alias: parts[1] };
  }
  throw new z.errors.Error(`"${raw}" is not an iShortn short link or alias`, 'InvalidLink', 400);
};

module.exports = { parseLinkRef };
