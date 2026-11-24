'use strict';

const { linkOutputFields } = require('../lib/fields');
const { BASE_URL, aliasPath, domainParams } = require('../lib/http');
const { parseLinkRef } = require('../lib/link-ref');
const samples = require('../lib/samples');

const perform = async (z, bundle) => {
  const { alias, domain } = parseLinkRef(z, bundle.inputData.link, bundle.inputData.domain);
  const response = await z.request({
    url: `${BASE_URL}/links/${aliasPath(alias)}`,
    params: domainParams(domain),
    allowNotFound: true,
  });
  return response.status === 404 ? [] : [response.data];
};

module.exports = {
  key: 'find_link',
  noun: 'Link',
  display: {
    label: 'Find Link',
    description: 'Finds a short link by its short URL or alias.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'link',
        label: 'Short link or alias',
        required: true,
        helpText: 'A short link such as `https://isht.app/launch-day`, or just its alias.',
      },
      {
        key: 'domain',
        label: 'Domain',
        required: false,
        helpText:
          'Only needed when the short link is an alias without a domain. Leave empty to use your default domain.',
      },
    ],
    sample: samples.LINK,
    outputFields: linkOutputFields,
  },
};
