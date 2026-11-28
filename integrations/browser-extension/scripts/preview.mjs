// Builds the dev-only preview into .preview/: the real popup bundle plus preview/mock.ts,
// which fakes chrome.* and the iShortn API. `npm run preview` also serves it.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const previewDir = join(root, ".preview");

export const buildPreview = async () => {
  await rm(previewDir, { recursive: true, force: true });
  await mkdir(previewDir, { recursive: true });
  await build({
    entryPoints: { popup: join(root, "src/popup.ts"), mock: join(root, "preview/mock.ts") },
    outdir: previewDir,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome110"],
    define: { __ISHORTN_BASE_URL__: JSON.stringify("https://ishortn.ink") },
    logLevel: "warning",
  });
  const html = await readFile(join(root, "src/popup.html"), "utf8");
  await writeFile(
    join(previewDir, "popup.html"),
    html
      // Linux maps system-ui to DejaVu Sans, which is much wider than the macOS and Windows UI
      // fonts. Use Inter when it's installed so renders match what most users see.
      .replace("</head>", `  <style>:root { --font: Inter, system-ui, sans-serif; }</style>\n  </head>`)
      .replace('<script src="popup.js"></script>', '<script src="mock.js"></script>\n    <script src="popup.js"></script>'),
  );
  await cp(join(root, "src/popup.css"), join(previewDir, "popup.css"));
  await cp(join(root, "icons"), join(previewDir, "icons"), { recursive: true });
  for (const file of ["frame.html", "frame.css", "frame.js"]) {
    await cp(join(root, "preview", file), join(previewDir, file));
  }
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** Serves .preview/ on localhost; resolves with the server and its base URL. */
export const servePreview = (port = 0) =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
      try {
        const body = await readFile(join(previewDir, path === "/" ? "frame.html" : path));
        res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404).end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPreview();
  const { url } = await servePreview(Number(process.env.PORT) || 4173);
  console.log(`Popup:  ${url}/popup.html?state=created`);
  console.log(`Frame:  ${url}/frame.html?state=created`);
  console.log("States: not-connected, manual, creating, created, customize, limit, unshortenable, unshortenable-empty, network-error");
}
