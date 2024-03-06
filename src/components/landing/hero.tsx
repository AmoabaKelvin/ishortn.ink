import { Button } from "@/components/ui/button";
import { Container, Illustrations, TryOutNow } from "@/lib/exports";
import Link from "next/link";

export function Hero() {
  return (
    <section className="hero_background flex flex-col">
      <Container className=" z-10 flex items-center flex-col  pt-20 text-center  lg:pt-26">
        <Link
          href="https://github.com/AmoabaKelvin/ishortn.ink"
          className="flex w-fit p-1 px-2 rounded-full ring-opacity-25 ring-1 ring-slate-400 select-none items-center bg-gradient-to-r from-slate-400 to-slate-800 bg-clip-text text-transparent"
        >
          <span className="">Join the ⭐ crew on GitHub!</span>
        </Link>

        <h1 className="max-w-5xl mx-auto text-4xl font-extrabold tracking-tight leading-tight mt-5 md:mt-5  text-slate-900 lg:text-[4.5rem]">
          Dynamic Links and Link Shortening
        </h1>
        <p className="max-w-2xl sub_linner text-slate-700 text-sm mx-auto mt-4 ">
          Create branded, trackable links in seconds, get insights into clicks,
          conversions, and more with our advanced link analytics.
        </p>
        <div className="flex justify-center mt-10 gap-x-6">
          <TryOutNow />
          <Button asChild variant="outline" className="flex gap-2">
            <Link href={"/auth/sign-up"}>Get Started</Link>
          </Button>
        </div>
      </Container>
      {/* Illustrations here */}
      <Illustrations />
    </section>
  );
}
