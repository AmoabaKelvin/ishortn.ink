export type ApiLink = {
	shortLink: string;
	url: string | null;
	alias: string | null;
	expiresAt: string | null;
	activatesAt: string | null;
	expiresAfter: number | null;
};

export type LinksPage = { data: ApiLink[]; nextCursor: string | null };

// Enough to find the newest link still seen after many of the newest are deleted.
export const SEEN_LIMIT = 100;

/**
 * The API lists links newest first but doesn't expose ids, so a link is known by
 * its short link (domain + alias). Everything above the first link seen before is
 * new; anything below it is older, even when it was never seen (it slid into view
 * because a newer link was deleted).
 */
export function takeNewLinks(page: ApiLink[], seen: ReadonlySet<string>) {
	const index = page.findIndex((link) => seen.has(link.shortLink));
	return index === -1
		? { newLinks: page, reachedSeen: false }
		: { newLinks: page.slice(0, index), reachedSeen: true };
}

/** Newly found links go in front so the list stays newest first. */
export function nextSeen(newLinks: ApiLink[], seen: string[]): string[] {
	return [...newLinks.map((link) => link.shortLink), ...seen].slice(0, SEEN_LIMIT);
}
