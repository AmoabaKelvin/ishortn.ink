'use strict';

const { App, api, appTester, authData, errorPayload } = require('./helpers');

const perform = App.triggers.new_link.operation.perform;

describe('error handling', () => {
  afterEach(() => jest.useRealTimers());

  it('throttles with Retry-After', async () => {
    api()
      .get('/links')
      .query(true)
      .reply(
        429,
        { error: { code: 'rate_limited', message: 'Rate limit exceeded. Retry in 12 seconds.' } },
        { 'Retry-After': '12' },
      );

    const error = await appTester(perform, { authData, inputData: {} }).catch((e) => e);
    expect(error.name).toBe('ThrottledError');
    expect(errorPayload(error)).toEqual({
      message: 'Rate limit exceeded. Retry in 12 seconds.',
      delay: 12,
    });
  });

  it('falls back to X-RateLimit-Reset, then 60 seconds', async () => {
    jest.useFakeTimers({
      now: new Date('2026-11-20T10:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout'],
    });
    const now = Math.floor(Date.now() / 1000);
    api()
      .get('/links')
      .query(true)
      .reply(429, {}, { 'X-RateLimit-Reset': String(now + 30) });
    api().get('/links').query(true).reply(429, 'Too many requests');

    const withReset = await appTester(perform, { authData, inputData: {} }).catch((e) => e);
    expect(errorPayload(withReset).delay).toBe(30);
    const bare = await appTester(perform, { authData, inputData: {} }).catch((e) => e);
    expect(errorPayload(bare).delay).toBe(60);
  });

  it('asks to retry on 5xx', async () => {
    api().get('/links').query(true).reply(502, 'Bad gateway');

    const error = await appTester(perform, { authData, inputData: {} }).catch((e) => e);
    expect(errorPayload(error).message).toBe(
      'iShortn returned an error (status 502). Try again in a minute.',
    );
  });

  it('passes a sunset warning through untouched', async () => {
    api()
      .get('/links')
      .query(true)
      .reply(200, { data: [], nextCursor: null, warning: 'API access ends on 2026-12-20' });

    const results = await appTester(perform, { authData, inputData: {} });
    expect(results).toEqual([]);
  });
});
