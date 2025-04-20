import {
  BarChartHorizontal,
  Blocks,
  Brush,
  LinkIcon,
  QrCode,
} from "lucide-react";

export const landingPageCopy = {
  features: [
    {
      name: "Fast Link Shortening",
      description:
        "Transform lengthy URLs into short, memorable links in just seconds. Our service is built for speed and reliability, ensuring your links work flawlessly across social media and anywhere else you need to share.",
      logo: LinkIcon,
    },
    {
      name: "Powerful Analytics",
      description:
        "Unlock deep insights into your audience. Track every single click and understand *who* is clicking, *where* they are, *what device* they're using, and *how* they found your link. Data to drive your strategy.",
      logo: BarChartHorizontal,
    },
    {
      name: "QR Code Generator",
      description:
        "Bridge the gap between the physical and digital world effortlessly. Generate customizable QR codes for any shortened link, perfect for print materials, product packaging, events, or driving traffic from offline sources.",
      logo: QrCode,
    },
    {
      name: "Developer-Friendly API",
      description:
        "Connect our robust URL shortening engine to your existing workflows and tools. Our comprehensive API makes integrating into your own apps a breeze.",
      logo: Blocks,
    },
    {
      name: "Branded & Custom Links",
      description:
        "Elevate your brand presence. Replace generic links with branded, custom short URLs that enhance trust and recognition. Create memorable links tailored perfectly for your marketing campaigns.",
      logo: Brush,
    },
  ],
  testimonials: [
    {
      quote:
        "This tool is a godsend. Thanks so much for thr work you did. I am using the link shortener and the QR code generator. It does everything I need it to. Please keep up the great work.",
      name: "FixatedManufacturing",
      title: "A Tale of Two Cities",
    },
    {
      quote:
        "We have been pasting posters around town using the QR Codes from this tool and now we know which posters are doing better than others! The tool looks great and it has really helped us grow. Great job man!",
      name: "Plamagandalla",
      title: "Hamlet",
    },
    {
      quote:
        "Just wanted to support your service. I am very grateful for this service. I am using it for private/personal use, but it is great to be able to keep track of URLs shortened by having a service with an account.",
      name: "AJ",
      title: "A Dream Within a Dream",
    },
    {
      quote: "Looks awesome. Minimalist and accurate",
      name: "Anonymous User",
      title: "Pride and Prejudice",
    },
  ],
  faq: [
    {
      question: "What is a URL shortener?",
      answer: `A URL shortener takes a long web address and creates a much shorter, easier-to-manage link. While they simplify sharing, services like ours add powerful tracking and management features beyond just shortening.`,
    },
    {
      question: "What are the benefits of using a shortened URL?",
      answer:
        "Shortened URLs are significantly easier to share and remember, especially across character-limited platforms. More importantly, they allow you to track clicks and gather vital data to understand performance and optimize your efforts.",
    },
    {
      question: "Are the shortened URLs permanent?",
      answer:
        "Yes, links created within your account are permanent and will remain active as long as your account is. You also have the flexibility to edit the destination URL or customize the back-half (alias) of your links.",
    },
    {
      question: "Can I track the performance of my links?",
      answer:
        "Absolutely. Our detailed analytics dashboard provides comprehensive tracking of every click. See where clicks originate (geolocation), which devices are used, and which sources (referrers) are driving traffic, giving you the data needed for informed decisions.",
    },
  ],
};
