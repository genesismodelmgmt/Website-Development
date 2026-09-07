#!/usr/bin/env node
// Screenshot helper for the local LWD Africa mirror.
//
//   NODE_PATH=/opt/node22/lib/node_modules node shot.mjs <path> <width> <height> <out.png> [--no-full]
//
// Example:
//   NODE_PATH=/opt/node22/lib/node_modules node /home/user/lwd-africa/shot.mjs \
//     /cars 390 844 /home/user/lwd-africa/shots/cars-390.png
//
// Base URL defaults to http://127.0.0.1:5199 and can be overridden with BASE_URL.

import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const [, , rawPath = "/", rawW = "1440", rawH = "900", rawOut, ...rest] = process.argv;
const width = Number(rawW);
const height = Number(rawH);
const fullPage = !rest.includes("--no-full");
const base = process.env.BASE_URL || "http://127.0.0.1:5199";
const url = base.replace(/\/$/, "") + (rawPath.startsWith("/") ? rawPath : "/" + rawPath);
const out = resolve(
  rawOut || `shots/shot-${rawPath.replace(/[^a-z0-9]+/gi, "-") || "home"}-${width}.png`,
);

mkdirSync(dirname(out), { recursive: true });

// Route external requests (Google Fonts, Wikimedia photos) through the session
// proxy so the page renders with its real fonts and images, as visitors see it.
// The proxy CA is already in the browser trust store; never disable TLS here.
const proxyServer = process.env.BROWSER_PROXY || process.env.HTTPS_PROXY;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--proxy-bypass-list=127.0.0.1;localhost"],
  ...(proxyServer ? { proxy: { server: proxyServer, bypass: "127.0.0.1,localhost" } } : {}),
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
});
// Google Fonts cannot be reached from the browser in this sandbox, and the
// fallback system font has different metrics, which would give false verdicts
// on wrapping and overflow. Serve the real CSS and woff2 files from the local
// cache instead, so text measures as it does for a visitor. The site source is
// untouched.
const fontDir = resolve(dirname(new URL(import.meta.url).pathname), "fontcache");
const fontMap = new Map();
try {
  for (const line of readFileSync(resolve(fontDir, "map.txt"), "utf8").trim().split("\n")) {
    const [remote, local] = line.split(" ");
    fontMap.set(remote, resolve(fontDir, local));
  }
} catch {
  // No cache: fall through and let the requests fail as before.
}
if (fontMap.size) {
  await context.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: readFileSync(resolve(fontDir, "fonts.css"), "utf8"),
    });
  });
  await context.route("https://fonts.gstatic.com/**", async (route) => {
    const file = fontMap.get(route.request().url());
    if (!file) return route.abort();
    await route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(file) });
  });
}

const page = await context.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText} ${r.url()}`));

const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
try {
  await page.waitForLoadState("networkidle", { timeout: 15000 });
} catch {
  // Remote Wikimedia photos / Google Fonts may never settle in a sandbox; carry on.
  console.log("note: networkidle not reached within 15s, screenshotting anyway");
}
await page.waitForTimeout(600);

await page.screenshot({ path: out, fullPage });

const title = await page.title();
const h1 = await page.locator("h1").first().textContent().catch(() => null);
const bodyChars = (await page.locator("body").innerText().catch(() => "")).length;

console.log(`url:      ${url}`);
console.log(`status:   ${response ? response.status() : "n/a"}`);
console.log(`viewport: ${width}x${height} (fullPage=${fullPage})`);
console.log(`title:    ${title}`);
console.log(`h1:       ${h1 ? h1.trim().slice(0, 120) : "(none)"}`);
console.log(`bodyText: ${bodyChars} chars`);
console.log(`saved:    ${out}`);
if (consoleErrors.length) {
  console.log(`console errors (${consoleErrors.length}):`);
  for (const e of consoleErrors.slice(0, 10)) console.log("  - " + e.slice(0, 220));
}
const local = failedRequests.filter((f) => f.includes("127.0.0.1"));
if (local.length) {
  console.log(`failed LOCAL requests (${local.length}):`);
  for (const f of local.slice(0, 15)) console.log("  - " + f.slice(0, 220));
}
const remote = failedRequests.length - local.length;
if (remote) console.log(`failed remote requests: ${remote} (external hosts, expected offline)`);

await browser.close();
