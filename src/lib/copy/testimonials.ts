export type Testimonial = {
  id: string;
  /** Shown verbatim, exactly as the customer approved it. */
  quote: string;
  name: string;
  company: string;
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
];
