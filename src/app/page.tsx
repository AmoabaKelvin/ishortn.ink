import LandingPageNav from "@/components/LandingPageNav";

export default function Home() {
  return (
    <>
      <LandingPageNav />
      <main className="flex min-h-screen flex-col items-center p-4 md:p-28">
        <section className="flex flex-col gap-6 md:flex-row w-full">
          {/* Left side */}
          <div className="flex flex-col justify-center items-center md:items-start md:justify-start md:w-1/2">
            <h1 className="text-4xl md:text-6xl font-bold text-center md:text-left font-ocean leading-10">
              <span className="leading-10">
                Transform links{" "}
                <span className="text-green-500">unleash results</span>
              </span>
            </h1>
            <p className="text-center md:text-left text-gray-100 mt-5 font-mazzardRegular leading-7">
              Power up your links with our AI-driven analytics, advanced URL
              shortening, and dynamic QR code creation and boost engagement
              results like never before. Unleash the power of your links today!
            </p>

            <button className="bg-green-500 text-white px-8 py-2 rounded-md mt-8 font-mazzardRegular hover:bg-green-600 duration-300">
              Try now
            </button>
          </div>

          {/* Right side */}
          <div className="flex justify-center items-center md:w-1/2">
            <h1>Some image will be placed here</h1>
          </div>
        </section>
      </main>
    </>
  );
}
