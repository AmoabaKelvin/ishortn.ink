import { getLivePosts, isPostLive } from "@/lib/blog";

const BLOG_PREFIX = "/blog/";

// Drops links to blog posts that are scheduled or unpublished, so a page can list a post before
// its date and the link appears once the post is live. Other links (docs) always pass.
export const visibleRelatedLinks = <T extends { href: string }>(links: T[], now = new Date()) =>
  links.filter(
    (link) =>
      !link.href.startsWith(BLOG_PREFIX) || isPostLive(link.href.slice(BLOG_PREFIX.length), now),
  );

// Links to the live posts among `slugs`, in order, labelled with each post's title.
export const livePostLinks = (slugs: readonly string[], now = new Date()) =>
  getLivePosts(slugs, now).map((post) => ({
    href: `${BLOG_PREFIX}${post.slug}`,
    label: post.title,
  }));
