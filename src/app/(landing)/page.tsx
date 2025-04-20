import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { landingPageCopy } from "@/copy/landing-page";
import { Paths } from "@/lib/constants";

import { Faq } from "./_components/faq";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";
import { CardSpotlight } from "./_components/hover-card";
import { InfiniteMovingCards } from "./_components/infinite-moving-cards";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "iShortn",
  },
  description:
    "URL Shortener with analytics, custom domains, and password protection.",
};

const HomePage = () => {
  return (
    <>
      <Header />
      <section className="mx-auto grid min-h-[calc(100vh-300px)] max-w-5xl flex-col  items-center justify-center gap-4 py-10 text-center  md:py-12">
        <div className="p-4">
          <h1 className="text-3xl font-bold text-center text-balance sm:text-5xl">
            Transform Your Links with Powerful Shortening and Analytics
          </h1>
          <p className="mt-4 mb-10 text-center text-balance text-muted-foreground md:text-lg lg:text-xl">
            Simple, Fast, and Insightful. Enhance your online presence with our
            robust URL shortening and tracking solution.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild className="px-10 py-6">
              <Link href={Paths.Login}>Get Started for free</Link>
            </Button>
          </div>
        </div>
      </section>
      <section>
        <div className="container mx-auto lg:max-w-screen-lg">
          <h1 className="mb-4 text-3xl font-bold text-center md:text-4xl lg:text-5xl">
            <a id="features" href="#features" aria-label="Features">
              Features
            </a>
          </h1>
          <p className="mb-10 text-center text-balance text-muted-foreground md:text-lg lg:text-xl">
            Discover the powerful features that make iShortn the ultimate URL
            shortening and tracking tool.
          </p>

          <div className="flex flex-wrap justify-center gap-6">
            {landingPageCopy.features.map((feature) => (
              <div className="w-[300px] max-w-full" key={feature.name}>
                <CardSpotlight
                  key={feature.name}
                  name={feature.name}
                  description={feature.description}
                  logo={<feature.logo className="h-7 w-7" />}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* section for testimonials */}
      <section className="container mx-auto mt-28 lg:max-w-screen-lg">
        <h1 className="mb-4 text-3xl font-bold text-center md:text-4xl lg:text-5xl">
          <a id="testimonials" href="#testimonials" aria-label="Testimonials">
            Testimonials
          </a>
        </h1>
        <p className="mb-10 text-center text-balance text-muted-foreground md:text-lg lg:text-xl">
          Hear what our customers have to{" "}
          <Link
            className="text-blue-500"
            href="https://buymeacoffee.com/kelvinamoaba"
            target="_blank"
          >
            say
          </Link>{" "}
          about iShortn.
        </p>
        <div className="relative flex h-[20rem] flex-col items-center justify-center overflow-hidden rounded-md antialiased dark:bg-black">
          <InfiniteMovingCards
            items={landingPageCopy.testimonials}
            direction="right"
            speed="slow"
          />
        </div>
      </section>

      {/* section for faqs */}
      <section className="container mx-auto mt-28 lg:max-w-screen-lg">
        <h1 className="mb-4 text-3xl font-bold text-center md:text-4xl lg:text-5xl">
          <a id="faq" href="#faq" aria-label="Frequently Asked Questions">
            Frequently Asked Questions
          </a>{" "}
        </h1>
        <p className="mb-10 text-center text-balance text-muted-foreground md:text-lg lg:text-xl">
          Find answers to common questions about iShortn.
        </p>
        <Faq faqs={landingPageCopy.faq} />
      </section>

      <div className="h-20" />
      <Footer />
    </>
  );
};

export default HomePage;
