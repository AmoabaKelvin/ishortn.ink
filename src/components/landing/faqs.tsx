import Image from "next/image";

import { Container } from "@/components/landing/container";
import backgroundImage from "../../../public/images/background-faqs.jpg";

const faqs = [
  [
    {
      question: "What features are included?",
      answer:
        "Running periodically, downloading results in various formats, data validation, and data visualization are all included in the VelaData subscription.",
    },
    {
      question: "Can I get a refund just in case?",
      answer:
        "Absolutely. We offer a refund policy to ensure your satisfaction. If, for any reason, you're not satisfied with our product within the specified refund period, you can request a refund.",
    },
    {
      question: "Do you offer email support?",
      answer:
        "Yes, we provide email support. If you have any questions, encounter issues, or need assistance, our dedicated support team is here to help.",
    },
  ],
  [
    {
      question: "Are the updates free for life?",
      answer:
        "Yes, updates are free for life. When you purchase your subscription, you'll have access to all future updates at no additional cost.",
    },
    {
      question: "Can I set it up to run periodically?",
      answer:
        "Yes, you can set up the tool to run periodically. Veladata offers the flexibility to schedule automated data extraction and analysis at your preferred intervals.",
    },
    {
      question: "How do I receive the data?",
      answer:
        "You can use the VelaData dashboard where you can log in to view and interact with the collected data. It can also be downloaded in formats like CSV, Excel, or PDF. It can also be emailed to you at specified intervals. It can also be sent to your cloud storage like AWS S3, Google Cloud Storage, or Azure Blob Storage.",
    },
  ],
];

export function Faqs() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="relative py-20 overflow-hidden bg-slate-50 sm:py-32"
    >
      <Image
        className="absolute left-1/2 top-0 max-w-none -translate-y-1/4 translate-x-[-30%]"
        src={backgroundImage}
        alt=""
        width={1558}
        height={946}
        unoptimized
      />
      <Container className="relative">
        <div className="max-w-2xl mx-auto lg:mx-0">
          <h2
            id="faq-title"
            className="text-3xl tracking-tight font-display text-slate-900 sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg tracking-tight text-slate-700">
            If you can’t find what you’re looking for, email our support team
            and someone will get back to you.
          </p>
        </div>
        <ul
          role="list"
          className="grid max-w-2xl grid-cols-1 gap-8 mx-auto mt-16 lg:max-w-none lg:grid-cols-2"
        >
          {faqs.map((column, columnIndex) => (
            <li key={columnIndex}>
              <ul role="list" className="flex flex-col gap-y-8">
                {column.map((faq, faqIndex) => (
                  <li key={faqIndex}>
                    <h3 className="text-lg leading-7 font-display text-slate-900">
                      {faq.question}
                    </h3>
                    <p className="mt-4 text-sm text-slate-700">{faq.answer}</p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
