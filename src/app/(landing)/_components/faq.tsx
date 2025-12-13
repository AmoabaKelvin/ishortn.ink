"use client";

import { landingPageCopy } from "@/lib/copy/landing-page";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export const Faq = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-[#050505] border-t border-white/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-white mb-4">
            FAQ.
          </h2>
          <p className="text-neutral-500">Common questions, answered.</p>
        </div>

        <div className="space-y-4">
          {landingPageCopy.faq.map((item, i) => (
            <div
              key={i}
              className={`border ${
                openIndex === i
                  ? "border-[#FF3300] bg-[#0A0A0A]"
                  : "border-white/10 bg-[#0A0A0A]"
              } transition-colors duration-300`}
            >
              <button
                className="w-full flex items-center justify-between p-6 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span
                  className={`font-bold ${
                    openIndex === i ? "text-white" : "text-neutral-400"
                  }`}
                >
                  {item.question}
                </span>
                {openIndex === i ? (
                  <Minus className="text-[#FF3300]" size={20} />
                ) : (
                  <Plus className="text-neutral-600" size={20} />
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="p-6 pt-0 text-neutral-500 text-sm leading-relaxed">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
