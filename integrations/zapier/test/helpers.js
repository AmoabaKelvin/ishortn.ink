'use strict';

const nock = require('nock');
const zapier = require('zapier-platform-core');

const App = require('../index');
const { BASE_URL } = require('../lib/http');

const appTester = zapier.createAppTester(App);

const authData = { api_key: 'ishortn_test_key' };

const api = () => nock(BASE_URL, { reqheaders: { 'x-api-key': authData.api_key } });

/**
 * A cursor store that persists across calls, like Zapier's. Core's local
 * cursorTestObj mock drops the value (19.3.0), so z.cursor is swapped instead.
 */
const createCursorStore = () => {
  let stored = null;
  return {
    get: async () => stored,
    set: async (value) => {
      stored = value;
    },
  };
};

const runWithCursor = (perform, bundle, cursor) =>
  appTester((z, innerBundle) => perform(Object.assign(z, { cursor }), innerBundle), bundle);

const link = (id, alias, domain = 'isht.app') => ({
  id,
  shortLink: `https://${domain}/${alias}`,
  url: `https://example.com/${alias}`,
  alias,
  createdAt: '2026-11-20T09:15:00.000Z',
  expiresAt: null,
  activatesAt: null,
  expiresAfter: null,
});

/** Parses the JSON message core wraps app errors in. */
const errorPayload = (error) => JSON.parse(error.message);

module.exports = {
  App,
  appTester,
  api,
  authData,
  createCursorStore,
  errorPayload,
  link,
  runWithCursor,
};
