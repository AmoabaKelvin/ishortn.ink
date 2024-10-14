"use client";

import { motion } from "framer-motion";
import { useState } from "react";

type FAQProps = {
  faqs: {
    question: string;
    answer: string;
  }[];
};

export function Faq({ faqs }: FAQProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 text-gray-800 md:py-16">
      <div className="space-y-4 first:mt-0">
        {faqs.map((faq, index) => (
          <motion.div
            key={faq.question}
            className="rounded-lg border border-gray-200 p-5 shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="flex cursor-pointer items-center justify-between"
              onClick={() => toggleFAQ(index)}
            >
              <h2 className="text-lg font-semibold text-gray-700">{faq.question}</h2>
              <motion.span
                animate={{ rotate: activeIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg
                  className="h-6 w-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <title>Plus</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </motion.span>
            </div>
            {activeIndex === index && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                transition={{ duration: 0.3 }}
                className="mt-4 overflow-hidden"
              >
                <p className="text-gray-600">{faq.answer}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
