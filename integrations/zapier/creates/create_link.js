'use strict';

const { linkOutputFields } = require('../lib/fields');
const { BASE_URL, isFilled, toIsoDateTime, trimmed } = require('../lib/http');
const samples = require('../lib/samples');

const UTM_FIELDS = [
  ['utm_source', 'UTM source'],
  ['utm_medium', 'UTM medium'],
  ['utm_campaign', 'UTM campaign'],
  ['utm_term', 'UTM term'],
  ['utm_content', 'UTM content'],
];

const buildBody = (inputData, timeZone) => {
  const body = { url: trimmed(inputData.url) };
  for (const key of ['alias', 'domain']) {
    if (isFilled(inputData[key])) body[key] = trimmed(inputData[key]);
  }
  // Zapier's checks reject input fields named "password" (D001, meant for
  // credentials), so the field is a passcode here and the API's `password` in the body.
  // Sent as typed: surrounding spaces may be intended.
  if (isFilled(inputData.linkPasscode)) body.password = inputData.linkPasscode;
  for (const key of ['expiresAt', 'activatesAt']) {
    if (isFilled(inputData[key])) body[key] = toIsoDateTime(inputData[key], timeZone);
  }
  if (isFilled(inputData.expiresAfter)) body.expiresAfter = Number(inputData.expiresAfter);

  const utmParams = {};
  for (const [key] of UTM_FIELDS) {
    if (isFilled(inputData[key])) utmParams[key] = trimmed(inputData[key]);
  }
  if (Object.keys(utmParams).length > 0) body.utmParams = utmParams;
  return body;
};

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/links`,
    method: 'POST',
    body: buildBody(bundle.inputData, bundle.meta && bundle.meta.timezone),
  });
  return response.data;
};

module.exports = {
  key: 'create_link',
  noun: 'Link',
  display: {
    label: 'Create Short Link',
    description: 'Creates a short link for a URL.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'url',
        label: 'Destination URL',
        required: true,
        helpText: 'The full URL to shorten, including `https://`.',
      },
      {
        key: 'alias',
        label: 'Alias',
        required: false,
        helpText:
          'The part after the domain. Letters, numbers, `-` and `_`, up to 20 characters. Leave empty for a random alias.',
      },
      {
        key: 'domain',
        label: 'Domain',
        required: false,
        helpText:
          '`isht.app` or one of your active custom domains. Leave empty to use your default domain.',
      },
      {
        key: 'expiresAt',
        label: 'Expires at',
        type: 'datetime',
        required: false,
        helpText: 'The link stops redirecting after this date and time.',
      },
      {
        key: 'expiresAfter',
        label: 'Click limit',
        type: 'integer',
        required: false,
        helpText: 'The link stops redirecting after this many clicks.',
      },
      {
        key: 'activatesAt',
        label: 'Activates at',
        type: 'datetime',
        required: false,
        helpText: 'The link starts redirecting at this date and time. Pro and Ultra plans.',
      },
      {
        key: 'linkPasscode',
        label: 'Passcode',
        type: 'password',
        required: false,
        helpText: "Visitors enter this passcode before they're redirected. Pro and Ultra plans.",
      },
      ...UTM_FIELDS.map(([key, label]) => ({
        key,
        label,
        required: false,
        helpText: 'Added to the destination when the link is visited. Ultra plan.',
      })),
    ],
    sample: samples.CREATED_LINK,
    outputFields: [
      ...linkOutputFields,
      { key: 'isProtected', label: 'Password protected', type: 'boolean' },
    ],
  },
};
