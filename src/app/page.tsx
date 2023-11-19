"use client";
import { LinkShortenerAndQRGenerator } from "@/components/forms/link-shortener-and-qr-generator";
import { FrequentlyAskedQuestions } from "@/components/landing-page/faq";
import PageFooter from "@/components/landing-page/footer";
import LandingPageNav from "@/components/landing-page/nav-bar";
import Image from "next/image";
import { useRef } from "react";
import landingImage from "../../public/images/home-image-removebg.png";

export default function Home() {
  const tryOutRef = useRef<HTMLDivElement | null>(null);

  const handleTryNowClick = () => {
    if (tryOutRef.current) {
      tryOutRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="h-full gradient">
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

        {/* section for the try out section, displays a tab where you can switch between generating QR Codes and shortnening links */}
        <section className="flex justify-center w-11/12 my-16 ">
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
