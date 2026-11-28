export type Testimonial = {
  id: string;
  /** Shown verbatim, exactly as the customer approved it. */
  quote: string;
  name: string;
  /** Job title, shown before the company in the caption. */
  role?: string;
  company: string;
  /** Company logo under public/, shown in the caption. */
  logo?: string;
  /** A shorter approved excerpt for tight spaces. */
  shortQuote?: string;
  /** A case study or the customer's own page. */
  href?: string;
};

export const testimonials: Testimonial[] = [
  {
    id: "felicia-westerlund",
    quote:
      "I use iShortn across my businesses for branded short links and QR codes, including the registration system I developed for SkinChX's onsite skin cancer screenings and remote community registrations. Using our own branded domains, reusable QR code templates and shared team workspace allows us to maintain consistent branding, simplify registration and manage links across different projects. I also use the platform to manage referral links while keeping tracking codes intact and presenting clean, professional branded URLs.",
    name: "Felicia Westerlund",
    company: "White Heart Group LLC",
  },
  {
    id: "chris-lastra-airo",
    quote:
      "iShortn is integral to our weekly reporting. It shows us which campaigns turn eyeballs into clicks and which don't, and it has saved us thousands of dollars. There's no more debate with stakeholders about what works, and we can hold partners to their promised numbers with a verifiable source of truth. I'd recommend it to any marketing team that wants real data behind its strategy instead of guesswork.",
    name: "Chris Lastra",
    role: "Marketing Manager",
    company: "AIRO",
    logo: "/images/customers/airo.svg",
    href: "/customers/airo",
    shortQuote:
      "It shows us which campaigns turn eyeballs into clicks, and it has saved us thousands of dollars.",
  },
];
