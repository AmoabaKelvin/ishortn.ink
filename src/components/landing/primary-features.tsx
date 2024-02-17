"use client";

import { Tab } from "@headlessui/react";
import clsx from "clsx";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Container } from "./container";

import analyticsScreenShot from "../../../public/images/screenshots/analytics.png";
import linkShorteningScreenShot from "../../../public/images/screenshots/create-link.png";
import dynamicLinksScreenShot from "../../../public/images/screenshots/dynamic-links-create.png";
import screenshotHomeScreen from "../../../public/images/screenshots/home-screen.png";

const features = [
  {
    title: "Link Shortening",
    description: "Create personalized links that match your brand",
    image: screenshotHomeScreen,
  },
  {
    title: "Link Analytics",
    description:
      "Track link analytics and measure your growth. We include everything you need to know ranging from clicks, countried, devices, and more.",
    image: analyticsScreenShot,
  },
  {
    title: "Dynamic Links",
    description:
      "Create links that direct users to any location within your app. Perfect for sharing content in your app.",
    image: linkShorteningScreenShot,
  },

  {
    title: "QR Codes",
    description: "Generate high-quality QR codes for your links",
    image: dynamicLinksScreenShot,
  },
];

export function PrimaryFeatures() {
  let [tabOrientation, setTabOrientation] = useState<"horizontal" | "vertical">(
    "horizontal",
  );

  useEffect(() => {
    let lgMediaQuery = window.matchMedia("(min-width: 1024px)");

    function onMediaQueryChange({ matches }: { matches: boolean }) {
      setTabOrientation(matches ? "vertical" : "horizontal");
    }

    onMediaQueryChange(lgMediaQuery);
    lgMediaQuery.addEventListener("change", onMediaQueryChange);

    return () => {
      lgMediaQuery.removeEventListener("change", onMediaQueryChange);
    };
  }, []);

  return (
    <section
      id="features"
      aria-label="Features for running your books"
      className="relative pt-20 overflow-hidden bg-zinc-800 pb-28 sm:py-32"
    >
      <Container className="relative">
        <div className="max-w-2xl md:mx-auto md:text-center xl:max-w-none">
          <h2 className="text-3xl tracking-tight text-white font-display sm:text-4xl md:text-5xl">
            Unlike any scraper out there
          </h2>
          <p className="mt-6 text-lg tracking-tight text-blue-100">
            100x faster. Designed to perfection. Simple for anyone to use.
          </p>
        </div>
        <Tab.Group
          as="div"
          className="grid items-center grid-cols-1 pt-10 mt-16 gap-y-2 sm:gap-y-6 md:mt-20 lg:grid-cols-12 lg:pt-0"
          vertical={tabOrientation === "vertical"}
        >
          {({ selectedIndex }) => (
            <>
              <div className="flex pb-4 -mx-4 overflow-x-auto sm:mx-0 sm:overflow-visible sm:pb-0 lg:col-span-5">
                <Tab.List className="relative z-10 flex px-4 gap-x-4 whitespace-nowrap sm:mx-auto sm:px-0 lg:mx-0 lg:block lg:gap-x-0 lg:gap-y-1 lg:whitespace-normal">
                  {features.map((feature, featureIndex) => (
                    <div
                      key={feature.title}
                      className={clsx(
                        "group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6",
                        selectedIndex === featureIndex
                          ? "bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10"
                          : "hover:bg-white/10 lg:hover:bg-white/5",
                      )}
                    >
                      <h3>
                        <Tab
                          className={clsx(
                            "font-display text-lg ui-not-focus-visible:outline-none  outline-none",
                            selectedIndex === featureIndex
                              ? "text-blue-600 lg:text-white"
                              : "text-blue-100 hover:text-white lg:text-white",
                          )}
                        >
                          <span className="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                          {feature.title}
                        </Tab>
                      </h3>
                      <p
                        className={clsx(
                          "mt-2 hidden text-sm lg:block",
                          selectedIndex === featureIndex
                            ? "text-white"
                            : "text-blue-100 group-hover:text-white",
                        )}
                      >
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </Tab.List>
              </div>
              <Tab.Panels className="lg:col-span-7">
                {features.map((feature) => (
                  <Tab.Panel key={feature.title} unmount={false}>
                    <div className="relative sm:px-6 lg:hidden">
                      <div className="absolute -inset-x-4 bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-inset ring-white/10 sm:inset-x-0 sm:rounded-t-xl" />
                      <p className="relative max-w-2xl mx-auto text-base text-white sm:text-center">
                        {feature.description}
                      </p>
                    </div>
                    <div className="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-xl shadow-blue-900/20 sm:w-auto lg:mt-0 lg:w-[67.8125rem]">
                      <Image
                        className="w-full"
                        src={feature.image}
                        alt=""
                        priority
                        sizes="(min-width: 1024px) 67.8125rem, (min-width: 640px) 100vw, 45rem"
                      />
                    </div>
                  </Tab.Panel>
                ))}
              </Tab.Panels>
            </>
          )}
        </Tab.Group>
      </Container>
    </section>
  );
}
