// Select options shared by the full audience survey and the acquisition prompt.

export const USE_CASE_OPTIONS = [
  { value: "social_media", label: "Social media bio or posts" },
  { value: "marketing_campaigns", label: "Marketing campaigns" },
  { value: "client_links", label: "Client work" },
  { value: "product_links", label: "Product or app links" },
  { value: "qr_codes", label: "QR codes for print or packaging" },
  { value: "internal_sharing", label: "Internal or team sharing" },
  { value: "other", label: "Something else" },
] as const;

export const ACQUISITION_CHANNEL_OPTIONS = [
  { value: "search", label: "Google or another search engine" },
  { value: "social", label: "Social media (X, Reddit, LinkedIn, etc.)" },
  { value: "friend_or_colleague", label: "A friend or colleague" },
  { value: "community", label: "A community or forum" },
  { value: "directory", label: "A directory or comparison article" },
  { value: "ad", label: "An advertisement" },
  { value: "other", label: "Somewhere else" },
] as const;
