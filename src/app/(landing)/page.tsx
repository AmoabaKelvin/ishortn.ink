import { BarChartHorizontal, Blocks, Brush, LinkIcon, QrCode } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { FAQ } from "./_components/faq";
import CardSpotlight from "./_components/hover-card";
import { InfiniteMovingCards } from "./_components/infinite-moving-cards";

import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "iShortn",
  description: "URL Shortener with analytics, custom domains, and password protection.",
};

const githubUrl = "https://github.com/AmoabaKelvin/ishortn.ink";

const features = [
  {
    name: "Link Shortening",
    description:
      "Shorten your links in seconds with our lightning-fast service. Whether for social media, email campaigns, or other uses, our shortened URLs are reliable and easy to share.",
    logo: LinkIcon,
  },
  {
    name: "In Depth Analytics",
    description:
      "Track every click and gain valuable insights into your audience's behavior. Our analytics provide detailed reports on clicks, geolocation, devices, and referrers.",
    logo: BarChartHorizontal,
  },
  {
    name: "QR Code Generation",
    description:
      "Easily generate QR codes for your shortened URLs. Perfect for print media, product packaging, or events, our QR codes enhance accessibility and engagement.",
    logo: QrCode,
  },
  {
    name: "Integrations",
    description:
      "Integrate our URL shortening service with your existing tools and workflows. Our API allows for seamless connection with your apps, making automation a breeze.",
    logo: Blocks,
  },
  {
    name: "Customizable Links",
    description:
      "Create branded, custom short links that enhance your brand's identity and make your URLs memorable. Personalize your links to fit your marketing campaigns seamlessly.",
    logo: Brush,
  },
];

const HomePage = () => {
  return (
    <>
      <section className="mx-auto grid min-h-[calc(100vh-300px)] max-w-5xl flex-col  items-center justify-center gap-4 py-10 text-center  md:py-12">
        <div className="p-4">
          <h1 className="text-balance text-center text-3xl font-bold sm:text-5xl">
            Transform Your Links with Powerful Shortening and Analytics
          </h1>
          <p className="mb-10 mt-4 text-balance text-center text-muted-foreground md:text-lg lg:text-xl">
            Simple, Fast, and Insightful. Enhance your online presence with our robust URL
            shortening and tracking solution.
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild className="px-10 py-6">
              <Link href="/login">Get Started for free</Link>
            </Button>
          </div>
        </div>
      </section>
      <section>
        <div className="container mx-auto lg:max-w-screen-lg">
          <h1 className="mb-4 text-center text-3xl font-bold md:text-4xl lg:text-5xl">
            <a id="features"></a> Features
          </h1>
          <p className="mb-10 text-balance text-center text-muted-foreground md:text-lg lg:text-xl">
            Discover the powerful features that make iShortn the ultimate URL shortening and
            tracking tool.
          </p>

          <div className="flex flex-wrap justify-center gap-6">
            {features.map((feature, i) => (
              <div className="w-[300px] max-w-full" key={i}>
                <CardSpotlight
                  key={i}
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
        <h1 className="mb-4 text-center text-3xl font-bold md:text-4xl lg:text-5xl">
          <a id="testimonials"></a> Testimonials
        </h1>
        <p className="mb-10 text-balance text-center text-muted-foreground md:text-lg lg:text-xl">
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
        <div className="relative flex h-[20rem] flex-col items-center justify-center overflow-hidden rounded-md antialiased">
          <InfiniteMovingCards items={testimonials} direction="right" speed="slow" />
        </div>
      </section>

      {/* section for faqs */}
      <section className="container mx-auto mt-28 lg:max-w-screen-lg">
        <h1 className="mb-4 text-center text-3xl font-bold md:text-4xl lg:text-5xl">
          <a id="faq"></a> Frequently Asked Questions
        </h1>
        <p className="mb-10 text-balance text-center text-muted-foreground md:text-lg lg:text-xl">
          Find answers to common questions about iShortn.
        </p>
        <FAQ faqs={faqs} />
      </section>
    </>
  );
};

export default HomePage;

const testimonials = [
  {
    quote:
      "This tool is a godsend. Thanks so much for thr work you did. I am using the link shortener and the QR code generator. It does everything I need it to. Please keep up the great work.",
    name: "FixatedManufacturing",
    title: "A Tale of Two Cities",
  },
  {
    quote:
      "We have been pasting posters around town using the QR Codes from this tool and now we know which posters are doing better than others! The tool looks great and it has really helped us grow. Great job man!",
    name: "Plamagandalla",
    title: "Hamlet",
  },
  {
    quote:
      "Just wanted to support your service. I am very grateful for this service. I am using it for private/personal use, but it is great to be able to keep track of URLs shortened by having a service with an account.",
    name: "AJ",
    title: "A Dream Within a Dream",
  },
  {
    quote: "Looks awesome. Minimalist and accurate",
    name: "Anonymous User",
    title: "Pride and Prejudice",
  },
];

const faqs = [
  {
    question: "What is a URL shortener?",
    answer: `A URL shortener, or link shortener, might seem like a basic tool, but it can significantly enhance your marketing strategies. 
    Link shorteners convert lengthy URLs into shorter, more user-friendly links. When someone clicks on the shortened link, they are redirected to the original, longer URL.`,
  },
  {
    question: "Are there benefits to using a shortened URL?",
    answer:
      "Shortened URLs are easier to share and remember, making them ideal for social media, email campaigns, and print media. They also provide valuable insights into your audience's behavior through analytics.",
  },
  {
    question: "Are shortened URLs permanent?",
    answer:
      "Shortened URLs are permanent and will continue to work as long as our service is active. You can also customize your links with a custom alias for added flexibility.",
  },
  {
    question: "Can I track the performance of my shortened URLs?",
    answer:
      "Yes, you can track the performance of your shortened URLs using our analytics dashboard. Gain insights into clicks, geolocation, devices, and referrers to optimize your marketing efforts.",
  },
];
