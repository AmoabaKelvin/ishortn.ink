'use client'
import LandingPageNav from "@/components/landing/nav-bar";
import { TryOutTab } from "@/components/tryout/shorten-link";
import { useEffect, useRef, useState } from "react";
import landingImage from "../../public/images/home-image-removebg.png";
import Image from 'next/image'; 

export default function Home() {
  const tryOutRef = useRef<HTMLDivElement | null>(null);
  const [click, setClicked] = useState(false);

  useEffect(() => {
    if (click && tryOutRef.current) {
      tryOutRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [click]);

  const handleTryNowClick = () => {
    setClicked(true);
  };
  return (
    <>
      <LandingPageNav />
      <main className="flex min-h-screen w-screen overflow-x-hidden flex-col items-center p-4 md:p-28">
        <section className="flex flex-col gap-6 md:flex-row w-full">
          {/* Left side */}
          <div className="flex flex-col mt-16 -mt-5  justify-center items-center md:items-start md:justify-start md:w-1/2">
            <h1 className=" font-bold text-center md:text-left font-ocean leading-10">
              <span className="leading-10 text-3xl md:text-6xl ">
                Transform links{" "}
                
              </span><br />
              <span className="text-green-500 text-2xl md:text-5xl">unleash results</span>
            </h1>
            
            <p className="text-center md:text-left text-gray-100 mt-5 font-mazzardRegular leading-7">
              Power up your links with our AI-driven analytics, advanced URL
              shortening, and dynamic QR code creation and boost engagement
              results like never before. Unleash the power of your links today!
            </p>
            

            <button className="bg-green-500 text-white px-8 py-2 rounded-md mt-8 font-mazzardRegular hover:bg-green-600 duration-300"
            onClick={handleTryNowClick}>
              Try now
            </button>
          </div>

          {/* Right side */}
          <div className="flex justify-center -mt-5 items-center md:w-1/2">
            <Image src={landingImage} alt="illustration" width={400} height={400} /> {/* Use the Image component */}
          </div>
        </section>

        {/* section for the try out section, displays a tab where you can switch between generating QR Codes and shortnening links */}
        <section className=" w-11/12 my-16">
        {click && <div ref={tryOutRef}> <TryOutTab /> </div>}
        </section>
      </main>
    </>
  );
}











