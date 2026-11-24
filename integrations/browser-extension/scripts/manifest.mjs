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
    name: "iShortn",
    short_name: "iShortn",
    version,
    description:
      "Shorten the page you're on, copy the link and get a QR code. Links stay editable and tracked in iShortn.",
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
      gecko: { id: "browser-extension@ishortn.ink", strict_min_version: "115.0" },
    };
  } else if (key) {
    manifest.key = key;
  }

  return manifest;
};

export const EXPECTED_PERMISSIONS = PERMISSIONS;
