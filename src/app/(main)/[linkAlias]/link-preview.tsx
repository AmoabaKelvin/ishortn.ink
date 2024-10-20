import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { satoshi } from "@/styles/fonts";
import type { RouterOutputs } from "@/trpc/shared";
import { ExternalLink } from "lucide-react";

function LinkPreview({
  link,
}: {
  link: RouterOutputs["link"]["retrieveOriginalUrl"];
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 justify-center h-screen",
        satoshi.className
      )}
    >
      <div className="leading-7 text-center">
        <h1 className="text-4xl font-bold">iShortn Link Preview</h1>
        <p className="text-muted-foreground max-w-lg">
          The link you followed was shortened with iShortn.ink. Shortened links
          can go anywhere on the internet, so be careful when clicking.
        </p>
      </div>

      <h2 className="text-2xl font-semibold mt-10">{`${link?.domain}/${link?.alias}`}</h2>
      <p>Redirects to</p>
      <h2 className="text-2xl font-semibold">{link?.url}</h2>
      <Button variant="outline" asChild>
        <a href={`https://${link?.domain}/${link?.alias}`}>
          Continue to Visit <ExternalLink className="ml-2 size-4" />
        </a>
      </Button>
    </div>
  );
}

export default LinkPreview;
