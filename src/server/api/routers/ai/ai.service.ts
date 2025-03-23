import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export async function generateAliasFromMetadata(metadata: {
  title?: string;
  description?: string;
  keywords?: string[];
  url: string;
}): Promise<Array<string>> {
  const result = await generateObject({
    model: openai("gpt-4o-mini", {
      structuredOutputs: true,
    }),
    schema: z.object({
      recommendations: z.array(z.string()),
    }),
    prompt: `You are a helpful assistant for a url shortening service, 
  your goal is to generate recommended aliases for the given metadata of a url in other to
  relieve the burden of thinking harrddd for an alias. Here is the metadata of the url:
  ${JSON.stringify(metadata)}
  Please generate a list of recommended aliases for the url.

  The alias should be:
  - Short (preferably 5-45 characters)
  - Memorable
  - Catchy
  - Relevant to the content
  - Lowercase, alphanumeric characters & underscores and hyphens only (no spaces or special characters)
  - Should not be more than 20 characters
  `,
  });

  return result.object.recommendations;
}

interface URLFeatures {
  url_length: number;
  num_dots: number;
  num_hyphens: number;
  num_underscores: number;
  num_digits: number;
  has_https: boolean;
  domain_length: number;
  subdomain_length: number;
  has_subdomain: boolean;
  path_length: number;
  has_query_params: boolean;
  has_ip_pattern: boolean;
  has_suspicious_chars: boolean;
  has_many_subdomains: boolean;
}

function extractUrlFeatures(url: string): URLFeatures {
  const features: URLFeatures = {
    url_length: url.length,
    num_dots: (url.match(/\./g) || []).length,
    num_hyphens: (url.match(/-/g) || []).length,
    num_underscores: (url.match(/_/g) || []).length,
    num_digits: (url.match(/\d/g) || []).length,
    has_https: url.startsWith("https://"),
    domain_length: 0,
    subdomain_length: 0,
    has_subdomain: false,
    path_length: 0,
    has_query_params: false,
    has_ip_pattern: false,
    has_suspicious_chars: false,
    has_many_subdomains: false,
  };

  try {
    const urlObj = new URL(url);

    // Domain analysis
    const domainParts = urlObj.hostname.split(".");
    const domain = domainParts[domainParts.length - 2] || "";
    const subdomains = domainParts.slice(0, -2);

    features.domain_length = domain.length;
    features.subdomain_length = subdomains.join(".").length;
    features.has_subdomain = subdomains.length > 0;
    features.has_many_subdomains = subdomains.length > 2;
    features.path_length = urlObj.pathname.length;
    features.has_query_params = urlObj.search.length > 0;

    // Suspicious patterns
    features.has_ip_pattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url);
    features.has_suspicious_chars = /[<>{}|\[\]~]/.test(url);
  } catch (error) {
    console.error("Error parsing URL:", error);
  }

  return features;
}

const phishingDetectionSchema = z.object({
  response: z.object({
    url: z.string(),
    phishing: z.boolean(),
  }),
});

type Metadata = {
  title: string;
  description: string;
  image: string;
  favicon: string;
};

export async function detectPhishingLink(
  url: string,
  metadata: Metadata
): Promise<{ url: string; phishing: boolean }> {
  const features = extractUrlFeatures(url);

  const result = await generateObject({
    model: openai("gpt-4o-mini", {
      structuredOutputs: true,
    }),
    temperature: 1,
    schema: phishingDetectionSchema,
    prompt: `You are a cybersecurity expert tasked with analyzing URLs for potential phishing attempts.
    Please analyze the following URL and determine if it is a potential phishing link.

    URL: ${url}

    FEATURES ANALYSIS:
    ${JSON.stringify(features, null, 2)}

    WEBSITE METADATA:
    ${JSON.stringify(metadata, null, 2)}

    IMPORTANT CONSIDERATIONS:
    1. DO NOT flag legitimate e-commerce sites, even if they have long URLs or complex paths
    2. Missing metadata is common with many legitimate sites and should NOT automatically indicate phishing
    3. Legitimate retail sites often have long product URLs with hyphens and numbers (e.g., product IDs)
    4. Consider the domain's primary purpose - retail sites like "targetsportscanada.com" are legitimate businesses

    Common legitimate e-commerce patterns:
    - Long paths containing product names, categories, and IDs
    - Multiple hyphens in the path section
    - Query parameters for tracking or session information
    - Subdomains like "shop.", "store.", or "www."

    TRUE PHISHING INDICATORS (multiple must be present):
    - Domains mimicking well-known brands but with spelling errors or character substitutions
    - Extremely short-lived domains (recently registered)
    - Nonsensical combinations of words in domains
    - Suspicious TLDs (.xyz, .tk, .ml) combined with brand impersonation
    - Base64 or otherwise encoded content in URL
    - Hidden redirects
    - IP addresses instead of domain names
    - Excessive subdomains (more than 3)

    Return FALSE for phishing UNLESS you are HIGHLY CONFIDENT the URL is malicious.
    If you are uncertain, err on the side of marking the URL as legitimate.
    `,
  });

  return result.object.response;
}
