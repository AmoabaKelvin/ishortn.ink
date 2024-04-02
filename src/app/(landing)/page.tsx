"use client";

import { motion, useAnimation, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { LinkShortenerAndQRGenerator } from "@/components/forms/link-shortener-and-qr-generator";
import { FrequentlyAskedQuestions } from "@/components/landing-page/faq";
import PageFooter from "@/components/landing-page/footer";
import LandingPageNav from "@/components/landing-page/nav-bar";
import { Button } from "@/components/ui/button";

import landingImage from "../../../public/images/home-image-removebg.png";

export default function Home() {
  const tryOutRef = useRef<HTMLDivElement | null>(null);
  const featuresRef = useRef<HTMLDivElement | null>(null);
  const controls = useAnimation();

  const isInView = useInView(featuresRef, {
    // once: true,
    once: false,
  });

  const handleTryNowClick = () => {
    if (tryOutRef.current) {
      tryOutRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <div className="h-full gradient">
      {/* <LandingPageBanner /> */}
      <LandingPageNav />
      <main className="flex flex-col items-center min-h-screen p-4 md:p-28">
        <section className="flex flex-col w-full gap-6 md:flex-row">
          {/* Left side */}
          <div className="flex flex-col items-center justify-center mt-16 md:-mt-5 lg:items-start lg:justify-start lg:w-2/3">
            <h1 className="font-bold leading-10 text-center lg:text-left font-ocean">
              <span className="text-5xl leading-10 md:text-6xl ">
                Transform links{" "}
              </span>
              <br />
              <span className="text-4xl text-green-500 md:text-5xl font-ocean">
                unleash results
              </span>
            </h1>

            <p className="mt-5 leading-7 text-center text-gray-100 lg:text-left font-mazzardRegular">
              Power up your links with our AI-driven analytics, advanced URL
              shortening, and dynamic QR code creation and boost engagement
              results like never before. Unleash the power of your links today!
            </p>

            <button
              className="px-8 py-2 mt-8 text-white duration-300 bg-green-500 rounded-md font-mazzardRegular hover:bg-green-600"
              onClick={handleTryNowClick}
            >
              Try now
            </button>
          </div>

          {/* Right side */}
          <div className="items-center justify-center hidden -mt-5 lg:flex md:w-1/2">
            <Image
              src={landingImage}
              alt="illustration"
              width={400}
              height={400}
            />{" "}
          </div>
        </section>

        <motion.img
          src="/images/home.png"
          alt="dashboard"
          // on hover tilt it slightly
          className="w-full mt-16 rounded-md"
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        />

        {/* Features section, big header and the features listed out */}
        <motion.section className="mt-16" ref={featuresRef} animate={controls}>
          <div className="flex flex-col items-center justify-center w-full my-10">
            <h1 className="text-6xl text-center font-ocean" id="features">
              Features
            </h1>
            <p className="mt-3 text-center text-gray-100 font-mazzardRegular">
              Discover a wealth of tools to enhance your link engagement
              effortlessly. Need a feature? Just leave a request!
            </p>
          </div>

          <div className="flex flex-col gap-20">
            <motion.div
              className="flex flex-col items-center justify-center gap-6 mt-16 md:flex-row"
              initial={{ opacity: 0, x: -100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              {/* left side */}
              <div className="flex flex-col w-full gap-4 md:w-1/2">
                <h1 className="text-3xl text-green-500 font-ocean link link-underline">
                  Link Shortening
                </h1>
                <p className="text-gray-100 font-mazzardRegular">
                  Easily condense lengthy URLs into shorter, more manageable
                  links with iShortn&apos;s intuitive interface. Streamline your
                  links without compromising on functionality.
                </p>
              </div>

              {/* right side */}
              <div className="flex items-center justify-center w-full duration-300 hover:rotate-2">
                <Image
                  src="/images/create-link.png"
                  alt="illustration"
                  width={600}
                  height={600}
                  className="rounded-md"
                />{" "}
              </div>
            </motion.div>

            {/* another feature, dynamic links */}
            <motion.div
              className="flex flex-col items-center justify-center gap-6 md:flex-row"
              initial={{ opacity: 0, x: 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              {/* left side */}
              <div className="flex flex-col w-full gap-4 md:w-1/2 group">
                <h1 className="text-3xl text-green-500 font-ocean link link-underline">
                  Dynamic Links
                </h1>
                <p className="text-gray-100 font-mazzardRegular">
                  Create dynamic links that adapt to different devices and
                  platforms, ensuring a seamless user experience across various
                  channels. Share content dynamically without worrying about
                  compatibility.
                </p>
              </div>

              {/* right side */}
              <div className="flex items-center justify-center w-full duration-300 hover:-rotate-2">
                <Image
                  src="/images/dynamic-links.png"
                  alt="illustration"
                  width={600}
                  height={600}
                  className="rounded-md"
                />{" "}
              </div>
            </motion.div>

            {/* another part, analytics */}
            <motion.div
              className="flex flex-col items-center justify-center gap-6 md:flex-row"
              initial={{ opacity: 0, x: -100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
            >
              {/* left side */}
              <div className="flex flex-col w-full gap-4 md:w-1/2">
                <h1 className="text-3xl text-green-500 font-ocean link link-underline">
                  Analytics
                </h1>
                <p className="leading-7 text-gray-100 font-mazzardRegular">
                  Gain valuable insights into link performance with in-depth
                  analytics. Track clicks, monitor geographical data, and
                  understand user behavior to optimize your strategies
                  effectively.
                </p>
              </div>

              {/* right side */}
              <div className="flex items-center justify-center w-full duration-300 hover:rotate-2">
                <Image
                  src="/images/analytics.png"
                  alt="illustration"
                  width={600}
                  height={600}
                  className="rounded-md"
                />{" "}
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Ready to dive in  */}
        <section className="flex flex-col items-center justify-center w-full my-28">
          <h1 className="text-4xl font-ocean">Ready to dive in?</h1>
          <p className="mt-3 text-gray-100 font-mazzardRegular">
            Create an account to get started today!
          </p>

          <Button
            className="px-8 py-2 mt-8 text-white duration-300 bg-green-500 rounded-md font-mazzardRegular hover:bg-green-600"
            asChild
          >
            <Link href="/auth/sign-up">Get started</Link>
          </Button>
        </section>

        {/* section for the try out section, displays a tab where you can switch between generating QR Codes and shortnening links */}
        <h1 className="mb-8 text-4xl font-bold text-center font-ocean">
          Try it out
        </h1>
        <section className="flex justify-center w-11/12 mb-16 ">
          <div ref={tryOutRef}>
            {" "}
            <LinkShortenerAndQRGenerator />{" "}
          </div>
        </section>

        <section className="md:w-6/12">
          <h1 className="my-10 text-2xl font-bold text-center font-mazzard">
            Frequently Asked Questions
          </h1>
          <FrequentlyAskedQuestions />
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
