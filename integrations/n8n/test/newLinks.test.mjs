import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextSeen, SEEN_LIMIT, takeNewLinks } from '../nodes/IShortnTrigger/newLinks.ts';

const link = (alias) => ({
	shortLink: `https://isht.app/${alias}`,
	url: `https://example.com/${alias}`,
	alias,
	expiresAt: null,
	activatesAt: null,
	expiresAfter: null,
});

const keys = (links) => links.map((item) => item.alias);

test('returns the links above the first one seen before', () => {
	const seen = new Set([link('b').shortLink, link('c').shortLink]);
	const result = takeNewLinks([link('new2'), link('new1'), link('b'), link('c')], seen);
	assert.deepEqual(keys(result.newLinks), ['new2', 'new1']);
	assert.equal(result.reachedSeen, true);
});

test('returns nothing when the newest link was already seen', () => {
	const seen = new Set([link('a').shortLink]);
	const result = takeNewLinks([link('a'), link('older')], seen);
	assert.deepEqual(result.newLinks, []);
	assert.equal(result.reachedSeen, true);
});

test('an older link that slides into view after a delete is not new', () => {
	// "b" was deleted; "z" was never on the first page before but is older than "c".
	const seen = new Set([link('b').shortLink, link('c').shortLink]);
	const result = takeNewLinks([link('c'), link('z')], seen);
	assert.deepEqual(result.newLinks, []);
});

test('keeps going when no seen link is on the page', () => {
	const result = takeNewLinks([link('x'), link('y')], new Set([link('a').shortLink]));
	assert.deepEqual(keys(result.newLinks), ['x', 'y']);
	assert.equal(result.reachedSeen, false);
});

test('nextSeen puts new links first and caps the list', () => {
	const seen = Array.from({ length: SEEN_LIMIT }, (_, index) => link(`old${index}`).shortLink);
	const next = nextSeen([link('n2'), link('n1')], seen);
	assert.equal(next.length, SEEN_LIMIT);
	assert.deepEqual(next.slice(0, 3), [link('n2').shortLink, link('n1').shortLink, seen[0]]);
});
