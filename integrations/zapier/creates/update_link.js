'use strict';

const { linkDomainField, linkField, linkOutputFields } = require('../lib/fields');
const {
  BASE_URL,
  aliasPath,
  domainParams,
  isFilled,
  toIsoDateTime,
  trimmed,
} = require('../lib/http');
const { parseLinkRef } = require('../lib/link-ref');
const samples = require('../lib/samples');

// The update schema is strict: only these keys may be sent. `domain` is left
// out on purpose, since a body domain moves the link to another domain.
const buildBody = (inputData, timeZone) => {
  const body = {};
  if (isFilled(inputData.url)) body.url = trimmed(inputData.url);
  if (isFilled(inputData.newAlias)) body.alias = trimmed(inputData.newAlias);
  for (const key of ['expiresAt', 'activatesAt']) {
    if (isFilled(inputData[key])) body[key] = toIsoDateTime(inputData[key], timeZone);
  }
  if (isFilled(inputData.expiresAfter)) body.expiresAfter = Number(inputData.expiresAfter);
  return body;
};

const perform = async (z, bundle) => {
  const { alias, domain } = parseLinkRef(z, bundle.inputData.link, bundle.inputData.domain);
  const response = await z.request({
    url: `${BASE_URL}/links/${aliasPath(alias)}`,
    method: 'PATCH',
    params: domainParams(domain),
    body: buildBody(bundle.inputData, bundle.meta && bundle.meta.timezone),
  });
  return response.data;
};

module.exports = {
  key: 'update_link',
  noun: 'Link',
  display: {
    label: 'Update Link',
    description: 'Changes the destination, alias, expiry or click limit of an existing short link.',
  },
  operation: {
    perform,
    inputFields: [
      linkField,
      linkDomainField,
      { key: 'url', label: 'New destination URL', required: false },
      {
        key: 'newAlias',
        label: 'New alias',
        required: false,
        helpText: 'Letters, numbers, `-` and `_`, up to 20 characters.',
      },
      { key: 'expiresAt', label: 'Expires at', type: 'datetime', required: false },
      { key: 'expiresAfter', label: 'Click limit', type: 'integer', required: false },
      { key: 'activatesAt', label: 'Activates at', type: 'datetime', required: false },
    ],
    sample: samples.LINK,
    outputFields: linkOutputFields,
  },
};
