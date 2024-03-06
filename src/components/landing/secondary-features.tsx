"use client";

import { Container, Tabs, linkShorteningScreenShot } from "@/lib/exports";
import Image from "next/image";

export function SecondaryFeatures() {
  const tabs = [
    {
      title: "Link Shortening",
      value: "Link Shortening",
      content: (
        <div className="screenshot text-blue-100">
          <p className="text-center">
            Create personalized links that match your brand
          </p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Link Analytics",
      value: "Link Analytics",
      content: (
        <div className="screenshot text-blue-100">
          <p className="text-center">
            Track link analytics and measure your growth. We include everything
            you need to know ranging from clicks, countried, devices, and more.
          </p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "Dynamic Links",
      value: "Dynamic Links",
      content: (
        <div className="screenshot text-blue-100">
          <p className="text-center">
            Create links that direct users to any location within your app.
            Perfect for sharing content in your app. tab
          </p>
          <DummyContent />
        </div>
      ),
    },
    {
      title: "QR Codes",
      value: "QR Codes",
      content: (
        <div className="screenshot text-blue-100 ">
          <p className="text-center">
            Generate high-quality QR codes for your links
          </p>
          <DummyContent />
        </div>
      ),
    },
  ];

  return (
    <section
      id="features"
      aria-label="Features for running your books"
      className="relative pt-10 lg:pt-32 overflow-hidden bg-zinc-800 "
    >
      <div className="max-w-2xl md:mx-auto md:text-center xl:max-w-none">
        <h2 className="text-3xl tracking-tight text-center text-white font-display sm:text-4xl md:text-5xl">
          Shorten, Track, Analyze, & More
        </h2>
        <p className="max-w-xl text-center mx-auto mt-6 sub_linner text-blue-100">
          Shorten links 100x faster, track clicks with granular detail, and
          create links that perfectly reflect your brand.
        </p>
      </div>
      <div className="h-[20rem] md:h-[40rem] lg:h-[50rem] [perspective:1000px] relative b flex flex-col max-w-5xl mx-auto w-full  items-start pt-10 justify-start">
        <Tabs tabs={tabs} />
      </div>
    </section>
  );
}

const DummyContent = () => {
  return (
    <Image
      src={linkShorteningScreenShot}
      alt="dummy image"
      priority
      sizes="(min-width: 1024px) 67.8125rem, (min-width: 640px) 100vw, 45rem"
    />
  );
};
