'use strict';

const LINK = {
  id: 48213,
  shortLink: 'https://isht.app/launch-day',
  url: 'https://example.com/blog/launch-day',
  alias: 'launch-day',
  createdAt: '2026-11-20T09:15:00.000Z',
  expiresAt: null,
  activatesAt: null,
  expiresAfter: 1000,
};

const CREATED_LINK = { ...LINK, isProtected: false };

const LINK_CLICKS = {
  id: 'isht.app/launch-day',
  alias: 'launch-day',
  domain: 'isht.app',
  totalClicks: 1284,
  verifiedClicks: 1102,
  topCountry: 'Ghana',
  topReferrer: 'Direct',
  topDevice: 'mobile',
  clicksPerDate: { '2026-11-18': 402, '2026-11-19': 517, '2026-11-20': 365 },
  uniqueClicksPerDate: { '2026-11-18': 311, '2026-11-19': 389, '2026-11-20': 254 },
  verifiedClicksPerDate: { '2026-11-18': 351, '2026-11-19': 438, '2026-11-20': 313 },
  clicksPerCountry: { Ghana: 640, Nigeria: 391, 'United States': 253 },
  clicksPerCity: { Accra: 512, Lagos: 318, Kumasi: 128 },
  clicksPerContinent: { Africa: 1031, 'North America': 253 },
  clicksPerDevice: { mobile: 902, desktop: 361, tablet: 21 },
  clicksPerOS: { Android: 611, iOS: 291, Windows: 247, macOS: 135 },
  clicksPerBrowser: { Chrome: 803, 'Mobile Safari': 288, Edge: 193 },
  clicksPerModel: { Unknown: 853, iPhone: 291, 'SM-A546E': 140 },
  clicksPerReferrer: { Direct: 702, X: 344, Instagram: 238 },
  window: { days: null, from: null, to: '2026-11-20T18:04:11.512Z' },
};

module.exports = { LINK, CREATED_LINK, LINK_CLICKS };
