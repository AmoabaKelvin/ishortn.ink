import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { getAllPosts, getPostBySlug } from "@/lib/blog";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export const alt = "Blog Post";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "iShortn Blog";

  const fontData = readFileSync(
    join(process.cwd(), "src/app/fonts/BerkeleyMono.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f5f5f4",
          padding: "40px",
          fontFamily: "Berkeley Mono",
        }}
      >
        {/* Lighter continuous lines */}
        <div style={{ position: "absolute", top: 50, left: 20, width: 1160, height: 1, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", bottom: 50, left: 20, width: 1160, height: 1, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", top: 20, left: 50, width: 1, height: 590, backgroundColor: "#ddd" }} />
        <div style={{ position: "absolute", top: 20, right: 50, width: 1, height: 590, backgroundColor: "#ddd" }} />

        {/* Bold L-shaped corner marks */}
        <div style={{ position: "absolute", top: 50, left: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, left: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, right: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", top: 50, right: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, left: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, left: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, right: 50, width: 60, height: 2, backgroundColor: "#aaa" }} />
        <div style={{ position: "absolute", bottom: 50, right: 50, width: 2, height: 60, backgroundColor: "#aaa" }} />

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flex: 1,
            padding: "60px 100px 90px 100px",
          }}
        >
          {/* Category label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 20,
              fontWeight: 400,
              marginBottom: 20,
            }}
          >
            <span style={{ color: "#2563eb" }}>BLOG</span>
            <span style={{ color: "#aaa", margin: "0 12px" }}>·</span>
            <span style={{ color: "#aaa" }}>ISHORTN.INK</span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 400,
              color: "#1a1a1a",
              lineHeight: 1.1,
              maxWidth: "1000px",
              marginLeft: -4,
            }}
          >
            {title}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Berkeley Mono",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
