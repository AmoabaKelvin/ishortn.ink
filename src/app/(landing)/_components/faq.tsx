"use client";

import { IconMinus, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type FAQProps = {
  faqs: {
    question: string;
    answer: string;
  }[];
};

export function Faq({ faqs }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-0 divide-y divide-zinc-800">
      {faqs.map((faq, index) => (
        <div key={faq.question}>
          <button
            type="button"
            onClick={() =>
              setOpenIndex(openIndex === index ? null : index)
            }
            className="flex w-full items-center justify-between py-6 text-left"
          >
            <span className="pr-8 text-base font-medium text-zinc-50">
              {faq.question}
            </span>
            <span className="shrink-0 text-zinc-500">
              {openIndex === index ? (
                <IconMinus size={18} stroke={1.5} />
              ) : (
                <IconPlus size={18} stroke={1.5} />
              )}
            </span>
          </button>
          <AnimatePresence initial={false}>
            {openIndex === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <p className="max-w-3xl pb-6 text-sm leading-relaxed text-zinc-400">
                  {faq.answer}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
