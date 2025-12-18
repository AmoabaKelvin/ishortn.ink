const DEFAULT_FAVICON = "https://www.google.com/s2/favicons?domain=ishortn.ink&sz=64";

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
    <div className="flex flex-col gap-2 rounded-lg border bg-white p-5">
      <div className="flex items-center font-semibold">
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
      <span className="text-sm">{metaDescription}</span>
      <span className="text-sm text-slate-500">
        {destinationURL?.replace(/(^\w+:|^)\/\//, "").split("/")[0] || "ishortn.ink"}
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
