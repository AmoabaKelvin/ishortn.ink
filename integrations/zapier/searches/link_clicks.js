'use strict';

const { linkClicksOutputFields, linkDomainField, linkField } = require('../lib/fields');
const { BASE_URL, aliasPath, domainParams } = require('../lib/http');
const { parseLinkRef } = require('../lib/link-ref');
const samples = require('../lib/samples');

/** The key with the most clicks, or '' when there are none. */
const topKey = (counts) => {
  let top = '';
  let max = -Infinity;
  for (const [key, count] of Object.entries(counts || {})) {
    if (count > max) {
      top = key;
      max = count;
    }
  }
  return top;
};

const perform = async (z, bundle) => {
  const { alias, domain } = parseLinkRef(z, bundle.inputData.link, bundle.inputData.domain);
  // A bare alias resolves to the account's default domain, which the analytics
  // body doesn't include; /me supplies it so the result has a full id.
  const [response, resolvedDomain] = await Promise.all([
    z.request({
      url: `${BASE_URL}/analytics/${aliasPath(alias)}`,
      params: domainParams(domain),
      allowNotFound: true,
    }),
    domain || z.request({ url: `${BASE_URL}/me` }).then((me) => me.data.defaultDomain),
  ]);
  if (response.status === 404) return [];

  const stats = response.data;
  return [
    {
      ...stats,
      id: `${resolvedDomain}/${alias}`,
      alias,
      domain: resolvedDomain,
      topCountry: topKey(stats.clicksPerCountry),
      topReferrer: topKey(stats.clicksPerReferrer),
      topDevice: topKey(stats.clicksPerDevice),
    },
  ];
};

module.exports = {
  key: 'link_clicks',
  noun: 'Link Clicks',
  display: {
    label: 'Find Link Clicks',
    description:
      'Finds the click totals and breakdowns by country, referrer and device for a short link.',
  },
  operation: {
    perform,
    inputFields: [linkField, linkDomainField],
    sample: samples.LINK_CLICKS,
    outputFields: linkClicksOutputFields,
  },
};
