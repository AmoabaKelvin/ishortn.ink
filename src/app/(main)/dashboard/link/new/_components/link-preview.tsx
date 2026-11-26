import { IconWorld } from "@tabler/icons-react";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function LinkPreviewComponent({
  destinationURL,
  metaTitle,
  metaDescription,
  metaImage,
  favicon,
  isLoading = false,
}: {
  destinationURL: string | undefined;
  metaTitle: string;
  metaDescription: string;
  metaImage: string;
  favicon: string;
  isLoading?: boolean;
}) {
  const [failedFavicon, setFailedFavicon] = useState<string | null>(null);
  const host = destinationURL
    ?.trim()
    .replace(/(^\w+:|^)\/\//, "")
    .split("/")[0];
  const showFavicon = !!favicon && failedFavicon !== favicon;

  return (
    <div
      aria-busy={isLoading}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-5"
    >
      <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
        {showFavicon ? (
          /* eslint-disable-next-line next/no-img-element -- favicon scraped from an arbitrary destination host */
          <img
            src={favicon}
            className="h-6 w-6 shrink-0 rounded-md"
            alt=""
            onError={() => setFailedFavicon(favicon)}
          />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-400 dark:bg-muted dark:text-muted-foreground">
            <IconWorld size={14} stroke={1.5} />
          </span>
        )}
        {isLoading ? (
          <Skeleton className="h-4 w-2/3" />
        ) : metaTitle ? (
          <span className="min-w-0 truncate">{metaTitle}</span>
        ) : (
          <span className="min-w-0 truncate font-medium text-neutral-400 dark:text-muted-foreground">
            {host ? "No title found" : "Page title"}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-4 w-full" />
      ) : metaDescription ? (
        <span className="text-[13px] text-neutral-600 dark:text-neutral-400">
          {metaDescription}
        </span>
      ) : (
        <span className="text-[13px] text-neutral-400 dark:text-muted-foreground">
          {host
            ? "This page has no description."
            : "Enter a destination URL to preview how your link will look."}
        </span>
      )}
      {host && (
        <span className="break-all text-[12px] text-neutral-400 dark:text-muted-foreground">
          {host}
        </span>
      )}
      {metaImage && !isLoading && (
        /* eslint-disable-next-line next/no-img-element -- OG image scraped from an arbitrary destination host */
        <img
          src={metaImage}
          className="w-full rounded-lg"
          alt="Link preview"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}
