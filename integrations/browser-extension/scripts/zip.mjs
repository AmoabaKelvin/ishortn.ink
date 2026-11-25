import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const collect = async (dir, base = dir, files = {}) => {
  for (const name of (await readdir(dir)).sort()) {
    const path = join(dir, name);
    if ((await stat(path)).isDirectory()) await collect(path, base, files);
    else files[relative(base, path).split("\\").join("/")] = new Uint8Array(await readFile(path));
  }
  return files;
};

for (const target of ["chrome", "firefox"]) {
  const files = await collect(join(root, "dist", target));
  if (!files["manifest.json"]) throw new Error(`dist/${target} is missing; run npm run build`);
  // Fixed timestamps keep the archive identical between builds of the same source.
  const entries = Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, [data, { mtime: new Date("2024-01-01T00:00:00Z") }]]),
  );
  const zip = zipSync(entries, { level: 9 });
  const name = `ishortn-${target}-${pkg.version}.zip`;
  await writeFile(join(root, "dist", name), zip);
  console.log(`dist/${name} (${(zip.length / 1024).toFixed(1)} KB)`);
}
