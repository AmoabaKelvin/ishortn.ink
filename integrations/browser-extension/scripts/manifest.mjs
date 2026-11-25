const PERMISSIONS = ["activeTab", "storage", "identity"];

const ICONS = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

/**
 * Builds the manifest for one browser. Everything except `background` and the Firefox
 * settings block is shared.
 * @param {"chrome" | "firefox"} target
 * @param {{ version: string, key?: string }} options
 */
export const buildManifest = (target, { version, key }) => {
  const manifest = {
    manifest_version: 3,
    // Chrome Web Store, Edge Add-ons and AMO show `name` and `description` as the listing title
    // and summary (limits: 75 and 132 characters).
    name: "iShortn: URL Shortener & QR Code Generator",
    short_name: "iShortn",
    version,
    description:
      "QR code for any page, no account needed. Sign in free to shorten it in one click: link copied, editable later, clicks tracked.",
    homepage_url: "https://ishortn.ink",
    icons: ICONS,
    action: {
      default_title: "Shorten with iShortn",
      default_popup: "popup.html",
      default_icon: { 16: ICONS[16], 32: ICONS[32] },
    },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Open iShortn",
      },
    },
    permissions: PERMISSIONS,
    background:
      target === "firefox" ? { scripts: ["background.js"] } : { service_worker: "background.js" },
  };

  if (target === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: "browser-extension@ishortn.ink",
        // 140 (ESR) is the first desktop release that supports `data_collection_permissions`,
        // which AMO requires for new add-ons.
        strict_min_version: "140.0",
        // The sign-in token, and the URL of the tab the user chooses to shorten, sent only to
        // ishortn.ink.
        data_collection_permissions: { required: ["authenticationInfo", "browsingActivity"] },
      },
    };
  } else if (key) {
    manifest.key = key;
  }

  return manifest;
};

export const EXPECTED_PERMISSIONS = PERMISSIONS;
