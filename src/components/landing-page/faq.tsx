import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const questionsAndAnswers = [
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
];

export function FrequentlyAskedQuestions() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {questionsAndAnswers.map(({ question, answer }, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-sm md:text-base">
            {question}
          </AccordionTrigger>
          <AccordionContent>{answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
