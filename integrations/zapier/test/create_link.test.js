'use strict';

const { App, api, appTester, authData, errorPayload, link } = require('./helpers');

const perform = App.creates.create_link.operation.perform;

const created = { ...link(48213, 'launch-day'), isProtected: false };

describe('Create Short Link', () => {
  it('sends only the filled fields', async () => {
    api()
      .post('/links', (body) => {
        expect(body).toEqual({
          url: 'https://example.com/blog/launch-day',
          alias: 'launch-day',
          expiresAt: '2026-12-01T09:00:00-05:00',
          expiresAfter: 1000,
          password: ' open sesame',
        });
        return true;
      })
      .matchHeader('content-type', /^application\/json/)
      .reply(201, created);

    const result = await appTester(perform, {
      authData,
      inputData: {
        url: ' https://example.com/blog/launch-day ',
        alias: 'launch-day',
        domain: '',
        expiresAt: '2026-12-01T09:00:00-05:00',
        expiresAfter: '1000',
        activatesAt: '',
        linkPasscode: ' open sesame',
        utm_source: '',
        utm_medium: '   ',
      },
    });
    expect(result).toEqual(created);
  });

  it('groups UTM fields into utmParams', async () => {
    api()
      .post('/links', (body) => {
        expect(body).toEqual({
          url: 'https://example.com',
          domain: 'go.example.com',
          utmParams: { utm_source: 'newsletter', utm_campaign: 'launch' },
        });
        return true;
      })
      .reply(201, created);

    await appTester(perform, {
      authData,
      inputData: {
        url: 'https://example.com',
        domain: 'go.example.com',
        utm_source: 'newsletter',
        utm_medium: '',
        utm_campaign: 'launch',
      },
    });
  });

  it('adds an offset to dates that lack one, using the Zap timezone', async () => {
    api()
      .post('/links', (body) => {
        expect(body.activatesAt).toBe('2026-07-01T13:00:00.000Z');
        expect(body.expiresAt).toBe('2026-12-01T15:00:00.000Z');
        return true;
      })
      .reply(201, created);

    await appTester(perform, {
      authData,
      inputData: {
        url: 'https://example.com',
        activatesAt: '2026-07-01T09:00:00',
        expiresAt: '2026-12-01 10:00',
      },
      meta: { timezone: 'America/New_York' },
    });
  });

  it('reads offset-less dates as UTC without a timezone', async () => {
    api()
      .post('/links', (body) => body.expiresAt === '2026-12-01T00:00:00.000Z')
      .reply(201, created);

    await appTester(perform, {
      authData,
      inputData: { url: 'https://example.com', expiresAt: '2026-12-01' },
    });
  });

  it('surfaces validation messages and details', async () => {
    api()
      .post('/links')
      .reply(400, {
        error: {
          code: 'validation_failed',
          message: 'Request body is invalid',
          details: [{ path: 'url', message: 'Invalid url' }],
        },
      });

    const error = await appTester(perform, {
      authData,
      inputData: { url: 'nope' },
    }).catch((e) => e);
    expect(errorPayload(error)).toEqual({
      message: 'Request body is invalid\nurl: Invalid url',
      code: 'validation_failed',
      status: 400,
    });
  });

  it('passes plan messages through as-is', async () => {
    api()
      .post('/links')
      .reply(403, {
        error: {
          code: 'forbidden',
          message: 'Scheduled links are only available on Pro and Ultra plans',
          details: [],
        },
      });

    const error = await appTester(perform, {
      authData,
      inputData: { url: 'https://example.com', activatesAt: '2026-12-01T00:00:00Z' },
    }).catch((e) => e);
    expect(errorPayload(error).message).toBe(
      'Scheduled links are only available on Pro and Ultra plans',
    );
  });
});
