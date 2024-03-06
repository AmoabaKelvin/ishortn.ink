import Image from "next/image";

import { Container } from "@/components/landing/container";
import backgroundImage from "../../../public/images/background-faqs.jpg";
import { TracingBeam } from "@/lib/exports";

const faqs = [
  [
    {
      question: "What is URL shortening, and why do I need it?",
      answer:
        "URL shortening is a technique that converts a long URL into a shorter, more manageable one. It's useful for sharing links on social media, in emails, or on printed materials where space is limited.",
    },
    {
      question: "Can I customize the shortened URLs?",
      answer:
        "Yes, we offer a customization feature that allows you to create branded, memorable short URLs. You can choose a custom alias for your links.",
    },
    {
      question: "Can I track shortened URLs performace?",
      answer:
        "Yes, our service provides detailed analytics that track the number of clicks, geographic location of users, device types, browsers and more, so you can measure the effectiveness of your links.",
    },
  ],
  [
    {
      question: "Is there a limit to the number of URLs I can shorten?",
      answer:
        "No, there's no limit. You can shorten as many URLs as you need, whether it's one or a thousand.",
    },
    {
      question: "What is a QR code?",
      answer:
        "A QR (Quick Response) code is a type of barcode that can store lots of information, from URLs, WiFi passwords, and more. They're often used in marketing and advertising to help customers find more information about a product or service.",
    },
    {
      question: "What other features can I expect in the future?",
      answer:
        "We're constantly working on improving our service. In the future, you can expect additional features such as link expiration, password protection, and more integrations.",
    },
    {
      question: "How do I get started with your service?",
      answer:
        "It's easy to get started. Simply sign up for an account, and you can start shortening URLs (with link tracking) and generating QR codes right away.",
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
      <TracingBeam className="">
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
              className="text-3xl tracking-tight font-display text-slate-800 sm:text-4xl"
            >
              Frequently asked questions
            </h2>
            <p className="mt-4 sub_linner_features text-slate-700">
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
                      <h3 className="text-lg leading-7 ">{faq.question}</h3>
                      <p className="mt-4 sub_linner_features text-slate-700">
                        {faq.answer}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Container>
      </TracingBeam>
    </section>
  );
}
