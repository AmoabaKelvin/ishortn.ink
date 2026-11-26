// Renders every popup state (light and dark, 2x) and the store screenshots (1280x800) from
// the preview harness. Output goes to store/.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { buildPreview, servePreview } from "./preview.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const statesDir = join(root, "store/popup-states");
await mkdir(statesDir, { recursive: true });

const STATES = [
  { name: "not-connected", view: "not-connected" },
  { name: "manual", view: "manual" },
  { name: "creating", view: "creating" },
  { name: "created", view: "created" },
  { name: "customize", view: "created", customize: true },
  { name: "limit", view: "limit" },
  { name: "unshortenable", view: "unshortenable", waitFor: ".list" },
  { name: "unshortenable-empty", view: "unshortenable", waitFor: ".empty", query: "unshortenable-empty" },
  { name: "unshortenable-created", query: "unshortenable", view: "unshortenable", waitFor: ".list", paste: true },
  { name: "network-error", view: "error" },
];

const pasteAndShorten = async (scope) => {
  await scope.locator("#paste-url").fill("docs.example.org/guides/getting-started");
  await scope.getByRole("button", { name: "Shorten", exact: true }).click();
  await scope.locator('#app[data-view="unshortenable-created"]').waitFor();
};

const openCustomize = async (scope) => {
  await scope.getByRole("button", { name: "Customize" }).click();
  await scope.locator("#custom-alias").fill("page-speed");
  await scope.locator("#custom-domain").selectOption("go.acmestudio.com");
  await scope.locator("#custom-alias").focus();
};

const settle = async (scope, { view, waitFor }) => {
  await scope.locator(`#app[data-view="${view}"]`).waitFor();
  if (waitFor) await scope.locator(waitFor).first().waitFor();
};

await buildPreview();
const { server, url } = await servePreview();
const browser = await chromium.launch();

try {
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 340, height: 120 },
      deviceScaleFactor: 2,
      colorScheme,
      reducedMotion: "reduce",
    });
    for (const state of STATES) {
      const page = await context.newPage();
      await page.goto(`${url}/popup.html?state=${state.query ?? state.name}`);
      await settle(page, state);
      if (state.customize) await openCustomize(page);
      if (state.paste) await pasteAndShorten(page);
      const file = join(statesDir, `${state.name}-${colorScheme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`store/popup-states/${state.name}-${colorScheme}.png`);
      await page.close();
    }
    await context.close();
  }

  const shots = [
    { file: "screenshot-1.png", state: "created", view: "created" },
    { file: "screenshot-2.png", state: "not-connected", view: "not-connected" },
    { file: "screenshot-3.png", state: "customize", view: "created", customize: true },
  ];
  const context = await browser.newContext({
    // 1024x640 CSS pixels at 1.25x gives the 1280x800 store size with the popup large enough
    // to read, scaled uniformly with the mock browser around it.
    viewport: { width: 1024, height: 640 },
    deviceScaleFactor: 1.25,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  for (const shot of shots) {
    const page = await context.newPage();
    await page.goto(`${url}/frame.html?state=${shot.state}`);
    const popup = page.frameLocator("#popup");
    await settle(popup, shot);
    if (shot.customize) await openCustomize(popup);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(root, "store", shot.file) });
    console.log(`store/${shot.file}`);
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}
