import type { JsonLdNode } from "@/lib/seo/structured-data";

type JsonLdProps = {
  data: JsonLdNode;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
