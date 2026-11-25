'use strict';

const nock = require('nock');

// Jest loads a fresh nock per test file inside a shared worker process, so each
// file restores its interceptors when done; otherwise the next file's mocks are
// bypassed and requests reach the network.
beforeAll(() => {
  if (!nock.isActive()) nock.activate();
  nock.disableNetConnect();
});
afterEach(() => {
  const pending = nock.pendingMocks();
  nock.cleanAll();
  if (pending.length > 0) throw new Error(`Requests not made: ${pending.join(', ')}`);
});
afterAll(() => {
  nock.enableNetConnect();
  nock.restore();
});
