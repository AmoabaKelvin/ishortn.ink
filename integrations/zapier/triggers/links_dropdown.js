'use strict';

const { BASE_URL } = require('../lib/http');
const samples = require('../lib/samples');

const MAX_URL_LENGTH = 60;

const truncate = (text) =>
  text.length > MAX_URL_LENGTH ? `${text.slice(0, MAX_URL_LENGTH - 1)}…` : text;

const perform = async (z, bundle) => {
  const params = { limit: 100 };
  if (bundle.meta && bundle.meta.page > 0) {
    const cursor = await z.cursor.get();
    // No stored cursor means the previous page was the last one.
    if (!cursor) return [];
    params.cursor = cursor;
  }

  const response = await z.request({ url: `${BASE_URL}/links`, params });
  const { data, nextCursor } = response.data;
  await z.cursor.set(nextCursor || '');

  return data.map((link) => ({
    id: link.shortLink,
    label: `${link.shortLink} → ${truncate(link.url || '')}`,
  }));
};

module.exports = {
  key: 'links_dropdown',
  noun: 'Link',
  display: {
    label: 'List Links',
    description: 'Lists your short links for the Link dropdown.',
    hidden: true,
  },
  operation: {
    type: 'polling',
    canPaginate: true,
    perform,
    sample: {
      id: samples.LINK.shortLink,
      label: `${samples.LINK.shortLink} → ${samples.LINK.url}`,
    },
    outputFields: [
      { key: 'id', label: 'Short link' },
      { key: 'label', label: 'Label' },
    ],
  },
};
