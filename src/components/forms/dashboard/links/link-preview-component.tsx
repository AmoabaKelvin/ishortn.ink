type LinkPreviewComponentProps = {
  destinationURL: string;
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
};

const LinkPreviewComponent = ({
  destinationURL,
  metaTitle,
  metaDescription,
  metaImage,
}: LinkPreviewComponentProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg">
        <div className="flex flex-col p-5 bg-white rounded-lg">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-500">
              {/* Get only the actual url, like devshare.dev from https://www.devshare.dev */}
              {destinationURL &&
                /^(https?:\/\/|www\.)[\w\-]+(\.[\w\-]+)+[/#?]?.*$/.test(
                  destinationURL,
                ) &&
                new URL(destinationURL).hostname.replace("www.", "")}
            </span>
            <span className="text-lg font-semibold">
              {metaTitle || "Title"}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm">{metaDescription || "Description"}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={metaImage || "https://via.placeholder.com/1200x630"}
            alt="OG Image"
            className="w-full mt-4 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default LinkPreviewComponent;
