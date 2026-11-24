'use strict';

const { App, api, appTester, authData, link } = require('./helpers');
const { aliasPath } = require('../lib/http');

const perform = App.creates.update_link.operation.perform;

describe('Update Link', () => {
  it('patches the referenced link and sends only filled fields', async () => {
    const updated = link(7, 'new-alias', 'example.link');
    api()
      .patch('/links/old', (body) => {
        expect(body).toEqual({ alias: 'new-alias', expiresAfter: 50 });
        return true;
      })
      .query({ domain: 'example.link' })
      .reply(200, updated);

    const result = await appTester(perform, {
      authData,
      inputData: {
        link: 'https://example.link/old',
        domain: 'ignored.example.com',
        url: '',
        newAlias: 'new-alias',
        expiresAt: '',
        expiresAfter: 50,
        activatesAt: null,
      },
    });
    expect(result).toEqual(updated);
  });

  it('uses the domain field and default domain for bare aliases', async () => {
    api()
      .patch('/links/launch-day', { url: 'https://example.com/new' })
      .query({ domain: 'go.example.com' })
      .reply(200, link(1, 'launch-day', 'go.example.com'));
    api()
      .patch('/links/launch-day', { url: 'https://example.com/new' })
      .query((query) => Object.keys(query).length === 0)
      .reply(200, link(1, 'launch-day'));

    await appTester(perform, {
      authData,
      inputData: { link: 'launch-day', domain: 'go.example.com', url: 'https://example.com/new' },
    });
    await appTester(perform, {
      authData,
      inputData: { link: 'launch-day', url: 'https://example.com/new' },
    });
  });

  it('URL-encodes the alias in the path', () => {
    // parseLinkRef only lets through letters, numbers, - and _, so this guards
    // the path if that pattern ever widens.
    expect(aliasPath(' a b/c ')).toBe('a%20b%2Fc');
  });
});
