import { Archivo } from "next/font/google";
import { Cta } from "./_components/cta";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { Footer } from "./_components/footer";
import { Hero } from "./_components/hero";
import { InfiniteLogos } from "./_components/infinite-logos";
import { Navbar } from "./_components/navbar";
import { Pricing } from "./_components/pricing";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-archivo",
});

export default function LandingPage() {
  return (
    <div
      className={`min-h-screen bg-[#050505] text-neutral-200 font-archivo selection:bg-[#FF3300] selection:text-black overflow-x-hidden ${archivo.variable}`}
    >
      {/* Background Grid */}
      <div className="fixed inset-0 grid-bg opacity-20 pointer-events-none z-0" />

      <Navbar />
      <Hero />
      <InfiniteLogos />
      <Features />
      <Pricing />
      <Faq />
      <Cta />
      <Footer />
    </div>
  );
}
