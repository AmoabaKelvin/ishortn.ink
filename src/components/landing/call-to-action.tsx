import { Container, SparklesCore } from "@/lib/exports";
import Link from "next/link";
import { Button } from "../ui/button";

export function CallToAction() {
  return (
    <section
      id="get-started-today"
      className="relative py-32 overflow-hidden bg-zinc-800 h-full w-full"
    >
      <Container className="relative">
        <div className=" w-ful flex flex-col items-center justify-center overflow-hidden rounded-md">
          <h2 className="text-3xl tracking-tight text-white font-display sm:text-4xl md:text-5xl">
            Ready to Dive in?
          </h2>

          <div className="w-[40rem] h-40 relative">
            <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
            <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
            <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
            <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

            <SparklesCore
              background="transparent"
              minSize={0.4}
              maxSize={1}
              particleDensity={200}
              className="w-full h-full "
              particleColor="#FFFFFF"
            />

            <div className="absolute inset-0 w-full h-full flex items-center justify-center flex-col bg-zinc-800 [mask-image:radial-gradient(350px_100px_at_top,transparent_10%,white)]">
              <p className="mt-4 sub_linner text-white z-20">
                Create an account to get started today
              </p>
              <Button asChild variant="outline" className="mt-10">
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/*

"use client";
import React from "react";
import { SparklesCore } from "../ui/sparkles";

export function SparklesPreview() {
  return (
    <div className="h-[40rem] w-full bg-black flex flex-col items-center justify-center overflow-hidden rounded-md">
      <h2 className="text-3xl tracking-tight text-white sm:text-4xl">
            Ready to Dive in?
          </h2>
          <p className="mt-4 sub_linner text-white">
            Create an account to get started today
          </p>
          <Button asChild variant="outline" className="mt-10">
            <Link href="/auth/sign-up">Get Started</Link>
          </Button>
      <div className="w-[40rem] h-40 relative">
       
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
        <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
        <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

        
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={1200}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />

        
        <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
      </div>
    </div>
  );
}

*/
