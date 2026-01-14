/**
 * Check if a URL can be displayed in an iframe by examining its response headers.
 * This checks for:
 * 1. Content-Security-Policy frame-ancestors directive
 * 2. X-Frame-Options header
 *
 * @param url - The destination URL to check
 * @param requestDomain - The domain that will be embedding the iframe (optional)
 * @returns Promise<boolean> - true if the URL can be iframed, false otherwise
 */
export async function isIframeable({
  url,
  requestDomain,
}: {
  url: string;
  requestDomain?: string;
}): Promise<boolean> {
  try {
    // Validate URL format
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    // Fetch with a timeout to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; iShortn/1.0; +https://ishortn.ink)",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    // Check Content-Security-Policy header for frame-ancestors
    const cspHeader = res.headers.get("content-security-policy");
    if (cspHeader) {
      const frameAncestorsMatch = cspHeader.match(/frame-ancestors\s+([\s\S]+?)(?=;|$)/i);
      if (frameAncestorsMatch?.[1]) {
        const frameAncestors = frameAncestorsMatch[1].trim();
        // Tokenize frame-ancestors value (can contain multiple space-separated tokens)
        const tokens = frameAncestors.split(/\s+/).map((t) => t.toLowerCase());

        // frame-ancestors 'none' - cannot be iframed at all (absolute deny)
        if (tokens.includes("'none'")) {
          return false;
        }

        // frame-ancestors * - can be iframed by anyone
        if (tokens.includes("*")) {
          return true;
        }

        // frame-ancestors 'self' - only same origin (we're cross-origin, so false)
        if (tokens.includes("'self'")) {
          return false;
        }

        // Check if our domain is in the allowed list
        if (requestDomain) {
          const requestDomainLower = requestDomain.toLowerCase();
          // Check for exact match or wildcard match
          for (const origin of tokens) {
            if (origin === requestDomainLower) {
              return true;
            }
            if (origin === `https://${requestDomainLower}`) {
              return true;
            }
            // Handle wildcards like *.example.com
            if (origin.startsWith("*.")) {
              const wildcardDomain = origin.slice(2);
              // Dot-boundary-safe check: sub.example.com matches *.example.com
              // but maliciousexample.com does NOT match *.example.com
              if (
                requestDomainLower === wildcardDomain ||
                requestDomainLower.endsWith(`.${wildcardDomain}`)
              ) {
                return true;
              }
            }
          }
          // Domain not in allowed list
          return false;
        }

        // If we have frame-ancestors but no requestDomain to check against,
        // and it's not 'none', '*', or 'self', assume it's restricted
        return false;
      }
    }

    // Check X-Frame-Options header
    const xFrameOptions = res.headers.get("x-frame-options");
    if (xFrameOptions) {
      const xfoValue = xFrameOptions.toUpperCase().trim();

      // DENY - cannot be iframed at all
      if (xfoValue === "DENY") {
        return false;
      }

      // SAMEORIGIN - only same origin can iframe (we're cross-origin, so false)
      if (xfoValue === "SAMEORIGIN") {
        return false;
      }

      // ALLOW-FROM is deprecated but some sites still use it
      if (xfoValue.startsWith("ALLOW-FROM")) {
        const allowedOrigin = xfoValue.replace("ALLOW-FROM", "").trim();
        if (requestDomain) {
          try {
            // Parse allowedOrigin as URL and compare hostname exactly
            // Add default scheme if missing for URL parsing
            const originToParse = allowedOrigin.startsWith("http")
              ? allowedOrigin
              : `https://${allowedOrigin}`;
            const parsedOrigin = new URL(originToParse);
            if (parsedOrigin.hostname.toLowerCase() === requestDomain.toLowerCase()) {
              return true;
            }
          } catch {
            // URL parsing failed, treat as no match
          }
        }
        return false;
      }
    }

    // No restrictive headers found - URL can be iframed
    return true;
  } catch (error) {
    // If fetch fails (timeout, network error, etc.), assume it cannot be iframed
    // This is a safe default as we don't want to promise cloaking for unreachable URLs
    console.error(`Error checking iframe compatibility for ${url}:`, error);
    return false;
  }
}
