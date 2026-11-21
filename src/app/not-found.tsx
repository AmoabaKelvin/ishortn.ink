import { IconLinkOff } from "@tabler/icons-react";

import { LinkStatusPage } from "@/components/link-status/link-status-page";
import { linkStatusMetadata } from "@/components/link-status/metadata";

export const metadata = linkStatusMetadata("Link not found");

export default function NotFound() {
  return (
    <LinkStatusPage
      icon={<IconLinkOff size={24} stroke={1.5} />}
      tone="neutral"
      title="This short link doesn't exist or was removed"
      description="Check the link for typos, or ask whoever shared it for a new one."
      campaign="not_found"
    />
  );
}
