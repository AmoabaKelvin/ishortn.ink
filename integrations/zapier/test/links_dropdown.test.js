'use strict';

const { App, api, authData, createCursorStore, link, runWithCursor } = require('./helpers');

const perform = App.triggers.links_dropdown.operation.perform;

describe('Links dropdown', () => {
  it('pages through links with the stored cursor', async () => {
    const cursor = createCursorStore();
    const longUrl = `https://example.com/${'a'.repeat(80)}`;

    api()
      .get('/links')
      .query({ limit: 100 })
      .reply(200, { data: [{ ...link(2, 'second'), url: longUrl }], nextCursor: 'cursor-2' });
    const firstPage = await runWithCursor(perform, { authData, meta: { page: 0 } }, cursor);

    expect(firstPage).toEqual([
      {
        id: 'https://isht.app/second',
        label: `https://isht.app/second → ${longUrl.slice(0, 59)}…`,
      },
    ]);

    api()
      .get('/links')
      .query({ limit: 100, cursor: 'cursor-2' })
      .reply(200, { data: [link(1, 'first')], nextCursor: null });
    const secondPage = await runWithCursor(perform, { authData, meta: { page: 1 } }, cursor);

    expect(secondPage).toEqual([
      { id: 'https://isht.app/first', label: 'https://isht.app/first → https://example.com/first' },
    ]);

    // The last page stored no cursor, so a further page makes no request.
    const thirdPage = await runWithCursor(perform, { authData, meta: { page: 2 } }, cursor);
    expect(thirdPage).toEqual([]);
  });
});
