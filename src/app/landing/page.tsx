import {
  CallToAction,
  Faqs,
  Footer,
  Header,
  Hero,
  PrimaryFeatures,
} from "@/lib/exports";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <PrimaryFeatures />
        <CallToAction />
        <Faqs />
      </main>
      <Footer />
    </>
  );
}
