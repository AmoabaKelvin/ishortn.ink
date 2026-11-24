'use strict';

const nock = require('nock');

const { App, api, appTester, authData, errorPayload } = require('./helpers');
const { BASE_URL } = require('../lib/http');

describe('authentication', () => {
  it('passes with a valid key and returns the account', async () => {
    api().get('/me').reply(200, {
      id: 'user_1',
      email: 'owner@example.com',
      name: 'Owner',
      plan: 'pro',
      defaultDomain: 'isht.app',
    });

    const result = await appTester(App.authentication.test, { authData });
    expect(result.email).toBe('owner@example.com');
  });

  it('asks to reconnect on 401', async () => {
    nock(BASE_URL)
      .get('/me')
      .reply(401, {
        error: { code: 'unauthorized', message: 'Invalid or missing API key', details: [] },
      });

    const error = await appTester(App.authentication.test, { authData }).catch((e) => e);
    expect(error.name).toBe('RefreshAuthError');
    expect(error.message).toContain('invalid or was deleted');
  });

  it('explains the plan requirement on the plan 403', async () => {
    nock(BASE_URL).get('/me').reply(403, {
      error: 'API access requires Pro',
      upgrade_url: 'https://ishortn.ink/pricing',
    });

    const error = await appTester(App.authentication.test, { authData }).catch((e) => e);
    expect(errorPayload(error)).toEqual({
      message:
        'The iShortn API needs a Pro or Ultra plan. Upgrade at https://ishortn.ink/pricing and try again.',
      code: 'PlanRequired',
      status: 403,
    });
  });

  it('labels the connection with the account email', () => {
    expect(App.authentication.connectionLabel).toBe('{{email}}');
  });
});
