import { SecondaryFeatures } from "@/components/landing/secondary-features";
import {
  CallToAction,
  Faqs,
  Footer,
  Header,
  Hero,
  PrimaryFeatures,
  Tabs,
} from "@/lib/exports";

export default function Home() {
  return (
    <>
      <Header />

      <Hero />
      {/* change to SecondaryFeatures to see new concept I am working on */}
      <PrimaryFeatures />
      <CallToAction />
      <Faqs />

      <Footer />
    </>
  );
}
