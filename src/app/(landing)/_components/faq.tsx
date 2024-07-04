"use client";

import { motion } from "framer-motion";
import { useState } from "react";

type FAQProps = {
  faqs: {
    question: string;
    answer: string;
  }[];
};

export function FAQ({ faqs }: FAQProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 md:py-16">
      {/* <h1 className="mb-10 text-center text-4xl font-bold text-gray-600">
        Frequently Asked Questions
      </h1> */}
      <div className="space-y-4 first:mt-0">
        {faqs.map((faq, index) => (
          <motion.div
            key={index}
            className="border-1 rounded-lg border p-5 shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="flex cursor-pointer items-center justify-between"
              onClick={() => toggleFAQ(index)}
            >
              <h2 className="text-lg font-semibold">{faq.question}</h2>
              <motion.span
                animate={{ rotate: activeIndex === index ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
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
                <p className="text-muted-foreground">{faq.answer}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
