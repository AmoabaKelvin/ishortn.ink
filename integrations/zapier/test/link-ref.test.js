'use strict';

const zapier = require('zapier-platform-core');

const { parseLinkRef } = require('../lib/link-ref');

const z = { errors: zapier.errors };

describe('parseLinkRef', () => {
  it('reads a full short link', () => {
    expect(parseLinkRef(z, 'https://isht.app/launch-day')).toEqual({
      domain: 'isht.app',
      alias: 'launch-day',
    });
  });

  it('reads domain/alias', () => {
    expect(parseLinkRef(z, 'go.Example.com/Promo_1', 'isht.app')).toEqual({
      domain: 'go.example.com',
      alias: 'Promo_1',
    });
  });

  it('reads a bare alias with and without the domain field', () => {
    expect(parseLinkRef(z, 'launch-day', ' go.example.com ')).toEqual({
      domain: 'go.example.com',
      alias: 'launch-day',
    });
    expect(parseLinkRef(z, ' launch-day ', '')).toEqual({ domain: undefined, alias: 'launch-day' });
  });

  it('strips query strings, fragments and a trailing slash', () => {
    expect(parseLinkRef(z, 'http://isht.app/launch-day/?utm_source=x#top')).toEqual({
      domain: 'isht.app',
      alias: 'launch-day',
    });
    expect(parseLinkRef(z, 'launch-day/')).toEqual({ domain: undefined, alias: 'launch-day' });
  });

  it.each(['', 'https://isht.app/', 'https://isht.app/a/b', 'not a link', 'localhost/abc'])(
    'rejects %p',
    (value) => {
      expect(() => parseLinkRef(z, value)).toThrow('is not an iShortn short link or alias');
    },
  );
});
