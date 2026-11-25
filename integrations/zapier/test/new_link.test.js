'use strict';

const { App, api, appTester, authData, link } = require('./helpers');

const perform = App.triggers.new_link.operation.perform;

describe('New Link trigger', () => {
  it('returns links in API order with their ids', async () => {
    const links = [link(3, 'newest'), link(2, 'middle'), link(1, 'oldest')];
    api().get('/links').query({ limit: 100 }).reply(200, { data: links, nextCursor: 'abc' });

    const results = await appTester(perform, { authData, inputData: {} });
    expect(results.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(results[0]).toEqual(links[0]);
  });

  it('filters by domain when one is set', async () => {
    api()
      .get('/links')
      .query({ limit: 100, domain: 'go.example.com' })
      .reply(200, { data: [link(9, 'promo', 'go.example.com')], nextCursor: null });

    const results = await appTester(perform, {
      authData,
      inputData: { domain: ' go.example.com ' },
    });
    expect(results).toHaveLength(1);
  });

  it('fetches three links when loading a sample', async () => {
    api()
      .get('/links')
      .query({ limit: 3 })
      .reply(200, { data: [link(1, 'one')], nextCursor: null });

    await appTester(perform, {
      authData,
      inputData: { domain: '' },
      meta: { isLoadingSample: true },
    });
  });
});
