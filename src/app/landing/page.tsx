// import { CallToAction } from "@/components/landing/call-to-action";
import { Faqs } from "@/components/landing/faqs";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { CallToAction } from "../../components/landing/call-to-action";
import { Hero } from "../../components/landing/hero";
import { Pricing } from "../../components/landing/pricing";
import { PrimaryFeatures } from "../../components/landing/primary-features";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <PrimaryFeatures />

        <CallToAction />
        {/* <Testimonials /> */}
        <Pricing />
        <Faqs />
      </main>
      <Footer />
    </>
  );
}
