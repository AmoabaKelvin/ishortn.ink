'use strict';

const { linkOutputFields } = require('../lib/fields');
const { BASE_URL, domainParams } = require('../lib/http');
const samples = require('../lib/samples');

// Newest first; Zapier dedupes on the numeric id, so one page per poll is enough.
const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/links`,
    params: {
      limit: bundle.meta && bundle.meta.isLoadingSample ? 3 : 100,
      ...domainParams(bundle.inputData.domain),
    },
  });
  return response.data.data;
};

module.exports = {
  key: 'new_link',
  noun: 'Link',
  display: {
    label: 'New Link',
    description: 'Triggers when a new short link is created in your iShortn personal workspace.',
  },
  operation: {
    type: 'polling',
    perform,
    inputFields: [
      {
        key: 'domain',
        label: 'Domain',
        required: false,
        helpText:
          'Only trigger for links on this domain, such as `isht.app` or one of your custom domains. Leave empty for all domains.',
      },
    ],
    sample: samples.LINK,
    outputFields: linkOutputFields,
  },
};
