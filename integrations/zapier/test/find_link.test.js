'use strict';

const { App, api, appTester, authData, link } = require('./helpers');

const perform = App.searches.find_link.operation.perform;

describe('Find Link', () => {
  it('returns the link when it exists', async () => {
    const found = link(5, 'launch-day');
    api().get('/links/launch-day').query({ domain: 'isht.app' }).reply(200, found);

    const results = await appTester(perform, {
      authData,
      inputData: { link: 'https://isht.app/launch-day' },
    });
    expect(results).toEqual([found]);
  });

  it('returns no results on 404', async () => {
    api()
      .get('/links/missing')
      .reply(404, { error: { code: 'not_found', message: 'Link not found', details: [] } });

    const results = await appTester(perform, { authData, inputData: { link: 'missing' } });
    expect(results).toEqual([]);
  });
});
