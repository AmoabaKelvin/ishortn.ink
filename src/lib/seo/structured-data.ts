export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "iShortn",
  url: "https://ishortn.ink",
  logo: "https://ishortn.ink/icon.png",
  sameAs: [
    "https://twitter.com/kelamoaba",
    "https://github.com/AmoabaKelvin/ishortn.ink",
  ],
  description: "Free URL shortener with powerful analytics, custom domains, and QR codes.",
};

export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "iShortn",
  url: "https://ishortn.ink",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      name: "Free",
      description: "30 links per month with basic analytics",
    },
    {
      "@type": "Offer",
      price: "5",
      priceCurrency: "USD",
      name: "Pro",
      description: "1,000 links per month with full analytics and custom domains",
    },
    {
      "@type": "Offer",
      price: "15",
      priceCurrency: "USD",
      name: "Ultra",
      description: "Unlimited links with team collaboration",
    },
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
  },
};

export function createFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "iShortn",
  url: "https://ishortn.ink",
  description: "Free URL shortener with powerful analytics, custom domains, and QR codes.",
  publisher: {
    "@type": "Organization",
    name: "iShortn",
    url: "https://ishortn.ink",
  },
};

export function createBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function createArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: article.url,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      "@type": "Person",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "iShortn",
      logo: {
        "@type": "ImageObject",
        url: "https://ishortn.ink/icon.png",
      },
    },
    ...(article.image && { image: article.image }),
  };
}
