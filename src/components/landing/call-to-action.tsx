import { Container } from "@/lib/exports";
import Link from "next/link";
import { Button } from "../ui/button";

export function CallToAction() {
  return (
    <section
      id="get-started-today"
      className="relative py-32 overflow-hidden bg-zinc-800"
    >
      <Container className="relative">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl tracking-tight text-white sm:text-4xl">
            Ready to Dive in?
          </h2>
          <p className="mt-4 sub_linner text-white">
            Create an account to get started today
          </p>
          <Button asChild variant="outline" className="mt-10">
            <Link href="dashboard">Get Started</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
