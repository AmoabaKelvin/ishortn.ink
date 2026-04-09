"use client";

import { IconMinus, IconPlus } from "@tabler/icons-react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

type FAQProps = {
  faqs: {
    question: string;
    answer: string;
  }[];
};

const FAQItem = ({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: { question: string; answer: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="border-b border-neutral-100 last:border-0"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-medium text-neutral-900">
          {faq.question}
        </span>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center text-neutral-400">
          {isOpen ? (
            <IconMinus size={16} stroke={1.5} />
          ) : (
            <IconPlus size={16} stroke={1.5} />
          )}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="pb-5">
              <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export function Faq({ faqs }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl">
      {faqs.map((faq, index) => (
        <FAQItem
          key={faq.question}
          faq={faq}
          index={index}
          isOpen={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
        />
      ))}
    </div>
  );
}
