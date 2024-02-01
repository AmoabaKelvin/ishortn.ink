import { Container } from "@/components/landing/container";
import { Button } from "@/components/ui/button";

import Link from "next/link";

export function CallToAction() {
  return (
    <section
      id="get-started-today"
      className="relative py-32 overflow-hidden bg-zinc-800"
    >
      <Container className="relative">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl tracking-tight text-white font-display sm:text-4xl">
            Get started today
          </h2>
          <p className="mt-4 text-lg tracking-tight text-white">
            Collect web data 100x faster
          </p>
          <Link href="dashboard">
            <Button variant="outline" className="mt-10">
              Get Started
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
