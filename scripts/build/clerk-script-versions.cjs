// Exact @clerk/clerk-js and @clerk/ui versions for the Clerk script tags, read from the
// installed SDK so they move with every Clerk upgrade. Left unset, the SDK requests the major
// tag (`clerk-js@6`) and Clerk's CDN answers with an uncacheable 307 to the exact version: one
// more round trip before the sign-in form can start loading. @clerk/shared only carries these
// versions as defaults inside its URL helpers, so they are read from the function sources and
// checked against the major tag the SDK would otherwise request.
const path = require("node:path");

// Resolved from @clerk/nextjs, not the root: @clerk/shared is its dependency, not ours, and may
// not be hoisted or may be a different copy there. Its package.json isn't exported, so the
// lookup starts from its entry file.
const clerkNextjsDir = path.dirname(require.resolve("@clerk/nextjs"));
const fromClerkNextjs = (id) => require(require.resolve(id, { paths: [clerkNextjsDir] }));
const { clerkJSScriptUrl, clerkUIScriptUrl } = fromClerkNextjs("@clerk/shared/loadClerkJsScript");
const { versionSelector } = fromClerkNextjs("@clerk/shared/versionSelector");

// Any valid key works: only the CDN path of the returned URL is compared.
const probeKey = `pk_live_${Buffer.from("clerk.example.com$").toString("base64")}`;

function pinnedVersion(source, defaultUrl, packageName) {
  const match = String(source).match(/"((\d+)\.\d+\.\d+)"/);
  if (!match || !defaultUrl.includes(`/npm/@clerk/${packageName}@${match[2]}/`)) return undefined;
  return match[1];
}

function clerkScriptVersions() {
  return {
    js: pinnedVersion(versionSelector, clerkJSScriptUrl({ publishableKey: probeKey }), "clerk-js"),
    ui: pinnedVersion(clerkUIScriptUrl, clerkUIScriptUrl({ publishableKey: probeKey }), "ui"),
  };
}

module.exports = { clerkScriptVersions, pinnedVersion };
