"use client";

import { motion, useInView } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { useRef } from "react";

const testimonials = [
  {
    quote:
      "This tool is a godsend. Thanks so much for the work you did. I am using the link shortener and the QR code generator. It does everything I need it to. Please keep up the great work.",
    name: "FixatedManufacturing",
    role: "Small Business Owner",
    rating: 5,
  },
  {
    quote:
      "We have been pasting posters around town using the QR Codes from this tool and now we know which posters are doing better than others! The tool looks great and it has really helped us grow.",
    name: "Plamagandalla",
    role: "Marketing Team",
    rating: 5,
  },
  {
    quote:
      "Just wanted to support your service. I am very grateful for this service. I am using it for private/personal use, but it is great to be able to keep track of URLs shortened by having a service with an account.",
    name: "AJ",
    role: "Individual Creator",
    rating: 5,
  },
  {
    quote:
      "Looks awesome. Minimalist and accurate. Exactly what I was looking for in a URL shortener. Clean interface, fast redirects, and the analytics are spot on.",
    name: "Anonymous User",
    role: "Developer",
    rating: 5,
  },
];

const TestimonialCard = ({
  testimonial,
  index,
}: {
  testimonial: (typeof testimonials)[0];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="testimonial-card group flex flex-col"
    >
      {/* Quote Icon */}
      <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 transition-colors group-hover:bg-neutral-900 group-hover:text-white">
        <Quote className="h-5 w-5" />
      </div>

      {/* Rating */}
      <div className="mb-4 flex gap-1">
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star
            key={i}
            className="h-4 w-4 fill-amber-400 text-amber-400"
          />
        ))}
      </div>

      {/* Quote */}
      <p className="flex-1 leading-relaxed text-neutral-700">
        &quot;{testimonial.quote}&quot;
      </p>

      {/* Author - Always at bottom */}
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-6 mt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-neutral-200 to-neutral-300 text-sm font-semibold text-neutral-600">
          {testimonial.name.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-neutral-900">{testimonial.name}</p>
          <p className="text-sm text-neutral-500">{testimonial.role}</p>
        </div>
      </div>
    </motion.div>
  );
};

export const Testimonials = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section id="testimonials" className="landing-section relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 landing-gradient-bg" />
      <div className="noise-overlay" />

      {/* Decorative */}
      <div className="gradient-blur top-1/4 -left-20 h-80 w-80 bg-blue-200/20" />
      <div className="gradient-blur bottom-1/4 -right-20 h-80 w-80 bg-purple-200/20" />

      <div className="landing-container relative z-10">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <div className="landing-badge mx-auto mb-6">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>Loved by Users</span>
          </div>
          <h2 className="font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
            What our users say
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            Join thousands of satisfied users who trust iShortn for their link
            management needs.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.name}
              testimonial={testimonial}
              index={index}
            />
          ))}
        </div>

        {/* Social Proof Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mt-16 flex flex-col items-center justify-center gap-6 rounded-3xl border border-neutral-200/60 bg-white/80 p-10 text-center backdrop-blur-sm sm:flex-row sm:gap-12"
        >
          <div>
            <p className="text-4xl font-bold text-neutral-900">10,000+</p>
            <p className="mt-1 text-sm text-neutral-500">Happy Users</p>
          </div>
          <div className="h-12 w-px bg-neutral-200 hidden sm:block" />
          <div>
            <p className="text-4xl font-bold text-neutral-900">4.9/5</p>
            <p className="mt-1 text-sm text-neutral-500">Average Rating</p>
          </div>
          <div className="h-12 w-px bg-neutral-200 hidden sm:block" />
          <div>
            <p className="text-4xl font-bold text-neutral-900">50M+</p>
            <p className="mt-1 text-sm text-neutral-500">Links Clicked</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
