// Combine the Vite-built app (dist/) with the landing site (website/) into _site/
// Layout:
//   _site/                ← landing page at the root
//   _site/app/            ← live demo (the actual app UI)
import { rm, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const distDir = resolve(root, "dist");
const websiteDir = resolve(root, "website");
const outDir = resolve(root, "_site");
const appDir = resolve(outDir, "app");

if (!existsSync(distDir)) {
  console.error(`[build-site] missing ${distDir} — run 'vite build' first`);
  process.exit(1);
}
if (!existsSync(websiteDir)) {
  console.error(`[build-site] missing ${websiteDir}`);
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(websiteDir, outDir, {
  recursive: true,
  filter: (src) => !src.endsWith("README.md"),
});
await mkdir(appDir, { recursive: true });
await cp(distDir, appDir, { recursive: true });

console.log(`[build-site] wrote landing + /app to ${outDir}`);
