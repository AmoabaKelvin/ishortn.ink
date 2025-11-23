import Link from "next/link";

export const Cta = () => {
  return (
    <section className="border-t border-white/10 bg-[#0A0A0A] py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#FF3300_0%,transparent_50%)] opacity-5 blur-[120px]" />

      <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
        <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-8">
          READY TO{" "}
          <span className="text-stroke-white text-transparent">START?</span>
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/auth/sign-up">
            <button className="bg-[#FF3300] text-black px-10 py-5 font-black text-lg uppercase tracking-widest hover:bg-white transition-colors">
              Create Free Account
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};
