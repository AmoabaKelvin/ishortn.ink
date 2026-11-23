// "Your links stay yours": shown on /compare/bitly and in the homepage and pricing FAQs, and
// repeated in content/docs/short-links.mdx and the Bitly blog posts. Each point is backed by code:
// - aliases on platform domains are tombstoned on delete, rename and account or team purge
//   (reserveLinkAliases in src/server/lib/reserved-alias.ts) and checked on create;
// - nothing in the redirect path turns a link or QR code off because of the owner's plan
//   (resolveShortLink in src/middlewares/resolve-link.ts); only an expiry the user sets does;
// - a trailing "!" renders a preview instead of redirecting and records no click
//   (src/app/(links)/[linkAlias]/page.tsx);
// - only workspaces that verified a custom domain can create links on it.
export const linkOwnershipPoints = [
  "Deleted short links on iShortn's shared domains are never given to anyone else. Once you delete or rename a link, its old address can't be claimed by another account, so it can't start pointing somewhere new.",
  "QR codes never expire. They keep redirecting on every plan, including after a paid plan ends. A code only switches off if you set an expiry date or scan limit yourself.",
  "Add ! to the end of any iShortn short link, such as isht.app/spring-sale!, to see where it goes before you open it.",
  "On your own custom domain, the links are yours. Only your workspaces can create links on it, and because you own the domain, its addresses go with you.",
] as const;

export const linkOwnershipFaq = {
  question: "Can someone else take over my short link after I delete it?",
  answer:
    "No. Deleted short links on iShortn's shared domains are never reassigned to another account, so an old printed or shared link can't start pointing somewhere new. QR codes never expire unless you set an expiry yourself, and you can add ! to the end of any iShortn short link to preview where it goes. On your own custom domain, the links are yours: only your workspaces can create links on it.",
};
