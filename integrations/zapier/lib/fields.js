'use strict';

const linkField = {
  key: 'link',
  label: 'Link',
  required: true,
  dynamic: 'links_dropdown.id.label',
  helpText: 'Pick a link, or map a short link such as `https://isht.app/launch-day`.',
};

const linkDomainField = {
  key: 'domain',
  label: 'Domain',
  required: false,
  helpText:
    'Only needed when Link is an alias without a domain. Leave empty to use your default domain.',
};

const linkOutputFields = [
  { key: 'id', label: 'Link ID', type: 'integer' },
  { key: 'shortLink', label: 'Short link' },
  { key: 'url', label: 'Destination URL' },
  { key: 'alias', label: 'Alias' },
  { key: 'createdAt', label: 'Created at', type: 'datetime' },
  { key: 'expiresAt', label: 'Expires at', type: 'datetime' },
  { key: 'activatesAt', label: 'Activates at', type: 'datetime' },
  { key: 'expiresAfter', label: 'Click limit', type: 'integer' },
];

const linkClicksOutputFields = [
  { key: 'id', label: 'ID' },
  { key: 'alias', label: 'Alias' },
  { key: 'domain', label: 'Domain' },
  { key: 'totalClicks', label: 'Total clicks', type: 'integer' },
  { key: 'verifiedClicks', label: 'Verified clicks', type: 'integer' },
  { key: 'topCountry', label: 'Top country' },
  { key: 'topReferrer', label: 'Top referrer' },
  { key: 'topDevice', label: 'Top device' },
  { key: 'window__from', label: 'Period start', type: 'datetime' },
  { key: 'window__to', label: 'Period end', type: 'datetime' },
];

module.exports = { linkField, linkDomainField, linkOutputFields, linkClicksOutputFields };
