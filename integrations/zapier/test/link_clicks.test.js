'use strict';

const { App, api, appTester, authData } = require('./helpers');
const { LINK_CLICKS } = require('../lib/samples');

const perform = App.searches.link_clicks.operation.perform;

const { id, alias, domain, topCountry, topReferrer, topDevice, ...body } = LINK_CLICKS;

describe('Find Link Clicks', () => {
  it('adds the id and top values, keeping the breakdowns', async () => {
    api()
      .get('/analytics/launch-day')
      .query({ domain: 'isht.app' })
      .reply(200, {
        ...body,
        clicksPerReferrer: { Direct: 100, X: 344, Instagram: 238 },
      });

    const [result] = await appTester(perform, {
      authData,
      inputData: { link: 'https://isht.app/launch-day' },
    });
    expect(result).toMatchObject({
      id: 'isht.app/launch-day',
      alias: 'launch-day',
      domain: 'isht.app',
      totalClicks: 1284,
      topCountry: 'Ghana',
      topReferrer: 'X',
      topDevice: 'mobile',
      clicksPerCountry: body.clicksPerCountry,
    });
  });

  it('resolves the default domain for a bare alias', async () => {
    api().get('/analytics/launch-day').reply(200, body);
    api()
      .get('/me')
      .reply(200, {
        id: 'u',
        email: 'a@example.com',
        name: null,
        plan: 'pro',
        defaultDomain: 'go.example.com',
      });

    const [result] = await appTester(perform, { authData, inputData: { link: 'launch-day' } });
    expect(result.id).toBe('go.example.com/launch-day');
    expect(result.domain).toBe('go.example.com');
  });

  it('returns empty strings when there are no clicks', async () => {
    api()
      .get('/analytics/quiet')
      .query({ domain: 'isht.app' })
      .reply(200, {
        ...body,
        totalClicks: 0,
        clicksPerCountry: {},
        clicksPerReferrer: {},
        clicksPerDevice: {},
      });

    const [result] = await appTester(perform, {
      authData,
      inputData: { link: 'isht.app/quiet' },
    });
    expect(result).toMatchObject({ topCountry: '', topReferrer: '', topDevice: '' });
  });

  it('returns no results on 404', async () => {
    api()
      .get('/analytics/missing')
      .query({ domain: 'isht.app' })
      .reply(404, { error: { code: 'not_found', message: 'Link not found', details: [] } });

    const results = await appTester(perform, {
      authData,
      inputData: { link: 'isht.app/missing' },
    });
    expect(results).toEqual([]);
  });
});
