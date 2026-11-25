// Types for manifest.mjs so the tests can import it under `strict`.
export type Manifest = chrome.runtime.ManifestV3 & {
  browser_specific_settings?: {
    gecko: {
      id: string;
      strict_min_version: string;
      data_collection_permissions: { required: string[] };
    };
  };
};

export declare const buildManifest: (
  target: "chrome" | "firefox",
  options: { version: string; key?: string },
) => Manifest;

export declare const EXPECTED_PERMISSIONS: string[];
