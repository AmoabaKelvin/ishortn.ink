import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";

const DEFAULT_FAVICON = `https://www.google.com/s2/favicons?domain=${DEFAULT_PLATFORM_DOMAIN}&sz=64`;

export function LinkPreviewComponent({
  destinationURL,
  metaTitle,
  metaDescription,
  metaImage,
  favicon,
}: {
  destinationURL: string | undefined;
  metaTitle: string;
  metaDescription: string;
  metaImage: string;
  favicon: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-5">
      <div className="flex items-center text-[14px] font-semibold text-neutral-900 dark:text-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={favicon || DEFAULT_FAVICON}
          className="mr-2 h-6 w-6 rounded-md"
          alt="Favicon"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_FAVICON;
          }}
        />
        {metaTitle}
      </div>
      <span className="text-[13px] text-neutral-600 dark:text-neutral-400">{metaDescription}</span>
      <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
        {destinationURL?.replace(/(^\w+:|^)\/\//, "").split("/")[0] || DEFAULT_PLATFORM_DOMAIN}
      </span>
      {metaImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
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
