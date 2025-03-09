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
    temperature: 0,
    schema: phishingDetectionSchema,
    prompt: `You are a cybersecurity expert tasked with analyzing URLs for potential phishing attempts.
    Please analyze the following URL and its characteristics to determine if it is a potential phishing link:

    URL: ${url}

    Here are some features about the domain to help you figure out:
    FEATURES:
    ${JSON.stringify(features)}

    Here is some metadata from the website, might help you out:
    ${JSON.stringify(metadata)}

    Consider these factors in your analysis:
    - Domain reputation and legitimacy
    - Commonly abused TLDs
    - URL structure and patterns common in phishing
    - Presence of intentionally misleading elements
    - Use of URL obfuscation techniques
    - Impersonation of well-known brands or services
    - Character substitution tricks (e.g., using '1' for 'l', '0' for 'o')
    - Excessive use of subdomains or unusual URL patterns

    Based on your comprehensive knowledge of phishing tactics, provide a determination of whether it appears to be a phishing attempt.
    Use your knowledge about popular phishing urls as well when making a conclusion
    `,
  });

  return result.object.response;
}
