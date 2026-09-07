#!/usr/bin/env node
// Independent acceptance checks for the LWD Africa responsive work.
//
//   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//     node verify.mjs
//
// Written to be adversarial: it re-tests the claimed fixes from scratch rather
// than trusting the reports, and it fails loudly. Real Google Fonts are served
// from the local cache so text metrics match production.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const BASE = process.env.BASE_URL || "http://127.0.0.1:5199";
const here = dirname(new URL(import.meta.url).pathname);
const fontDir = resolve(here, "fontcache");

const ROUTES = ["/", "/cars", "/cars/mercedes-g-class", "/ship-to/nigeria", "/privacy", "/cookies"];
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function withFonts(context) {
  let map;
  try {
    map = new Map(
      readFileSync(resolve(fontDir, "map.txt"), "utf8")
        .trim()
        .split("\n")
        .map((l) => {
          const [remote, local] = l.split(" ");
          return [remote, resolve(fontDir, local)];
        }),
    );
  } catch {
    return;
  }
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ status: 200, contentType: "text/css", body: readFileSync(resolve(fontDir, "fonts.css"), "utf8") }),
  );
  await context.route("https://fonts.gstatic.com/**", (r) => {
    const f = map.get(r.request().url());
    return f ? r.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(f) }) : r.abort();
  });
}

async function newPage(browser, { width, height = 844, consent = "accepted", reducedMotion } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  await withFonts(context);
  if (consent) await context.addInitScript((v) => localStorage.setItem("lwd-cookie-consent", v), consent);
  const page = await context.newPage();
  return { page, context };
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--proxy-bypass-list=127.0.0.1;localhost"] });

// 1. No horizontal overflow on any route at any width.
for (const width of WIDTHS) {
  const { page, context } = await newPage(browser, { width });
  const bad = [];
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const o = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      innerW: window.innerWidth,
    }));
    if (o.scrollW > o.clientW) bad.push(`${route} ${o.scrollW}>${o.clientW}`);
  }
  record(`no horizontal overflow @${width}`, bad.length === 0, bad.join(", "));
  await context.close();
}

// 2. First visit does not scroll the page away from the hero.
for (const width of [390, 1440]) {
  const { page, context } = await newPage(browser, { width, consent: null });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const trace = [];
  for (let i = 0; i < 10; i++) {
    trace.push(await page.evaluate(() => Math.round(window.scrollY)));
    await page.waitForTimeout(250);
  }
  const max = Math.max(...trace);
  record(`first visit stays at top @${width}`, max === 0, `max scrollY ${max} (${trace.join(" ")})`);
  await context.close();
}

// 3. The mobile drawer actually covers the viewport below the header.
for (const width of [320, 375, 390, 430, 768]) {
  const { page, context } = await newPage(browser, { width });
  await page.goto(BASE + "/cars", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  // The dev server hydrates a second or two after domcontentloaded and any click
  // before that is silently dropped, so retry until the toggle reports open
  // rather than measuring a closed drawer and calling it a bug.
  let opened = false;
  for (let attempt = 0; attempt < 6 && !opened; attempt++) {
    await page.getByRole("button", { name: /open menu/i }).click();
    opened = await page
      .waitForFunction(() => document.querySelector("header button[aria-expanded]")?.getAttribute("aria-expanded") === "true", null, { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!opened) {
    record(`drawer covers viewport @${width}`, false, "menu never opened");
    await context.close();
    continue;
  }
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const drawer = document.getElementById("site-nav-mobile");
    if (!drawer) return { err: "no drawer" };
    const r = drawer.getBoundingClientRect();
    const scrim = drawer.firstElementChild.getBoundingClientRect();
    // What is painted at the centre of the drawer area: page content showing
    // through would mean the scrim is not covering.
    const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      top: Math.round(r.top),
      height: Math.round(r.height),
      scrimH: Math.round(scrim.height),
      vh: window.innerHeight,
      hitInsideDrawer: !!(el && drawer.contains(el)),
    };
  });
  const covers = !m.err && m.height >= m.vh - m.top - 2 && m.hitInsideDrawer;
  record(`drawer covers viewport @${width}`, covers, JSON.stringify(m));
  await context.close();
}

// 4. Anchor links land below the sticky header, not behind it.
for (const width of [390, 1440]) {
  const { page, context } = await newPage(browser, { width });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const bad = [];
  for (const id of ["services", "destinations", "process", "contact"]) {
    await page.evaluate((i) => {
      location.hash = "";
      location.hash = i;
    }, id);
    await page.waitForTimeout(900);
    const r = await page.evaluate((i) => {
      const s = document.getElementById(i);
      const header = document.querySelector("header");
      return {
        top: Math.round(s.getBoundingClientRect().top),
        headerH: Math.round(header.getBoundingClientRect().height),
      };
    }, id);
    // The section's top edge must sit at or below the header's bottom edge.
    if (r.top < r.headerH - 2) bad.push(`#${id} top ${r.top} < header ${r.headerH}`);
  }
  record(`anchors clear the sticky header @${width}`, bad.length === 0, bad.join(", "));
  await context.close();
}

// 5. Nothing is left permanently invisible by the scroll-driven reveal.
for (const [width, height] of [
  [390, 844],
  [1440, 900],
  [1280, 700],
  [1440, 1100],
]) {
  const { page, context } = await newPage(browser, { width, height });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const worst = await page.evaluate(async () => {
    const sections = Array.from(document.querySelectorAll("section, article"));
    const seen = new Map(sections.map((s) => [s, 1]));
    const step = Math.round(window.innerHeight * 0.5);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      // behavior:"instant" is essential: html has scroll-behavior:smooth, so a
      // plain scrollTo animates and every sample would read a page that has
      // barely moved.
      window.scrollTo({ top: y, behavior: "instant" });
      // Two frames is enough for layout but not for a running animation to
      // settle, which reads as an element stuck a hair under 1. Give the
      // reveal time to finish before sampling.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 260));
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        const inView = r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
        if (!inView) continue;
        const o = parseFloat(getComputedStyle(s).opacity);
        // Track the BEST opacity each element ever reaches while in view.
        seen.set(s, Math.max(seen.get(s) === 1 ? 0 : seen.get(s), o));
      }
    }
    let min = 1;
    let which = "";
    for (const [s, o] of seen) {
      if (o < min) {
        min = o;
        which = s.id || s.className.slice(0, 40);
      }
    }
    return { min: Number(min.toFixed(3)), which, count: sections.length };
  });
  record(
    `every section reaches full opacity @${width}x${height}`,
    worst.min >= 0.99,
    `worst ${worst.min} on "${worst.which}" of ${worst.count}`,
  );
  await context.close();
}

// 6. Reduced motion: nothing animated, nothing stuck invisible.
{
  const { page, context } = await newPage(browser, { width: 390, reducedMotion: "reduce" });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("section, article"));
    const faded = sections.filter((s) => parseFloat(getComputedStyle(s).opacity) < 0.99).length;
    return { faded, total: sections.length, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
  });
  record("reduced motion: nothing left faded", r.faded === 0, JSON.stringify(r));
  await context.close();
}

// 7. Primary touch targets are at least 44px on a phone.
{
  const { page, context } = await newPage(browser, { width: 390 });
  await page.goto(BASE + "/cars", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const small = await page.evaluate(() => {
    const sel = "header button, section.sticky button, section.sticky select, section.sticky input";
    return Array.from(document.querySelectorAll(sel))
      .map((el) => ({ tag: el.tagName, text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 18), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((x) => x.h > 0 && x.h < 44);
  });
  record("filter and nav controls are >=44px tall", small.length === 0, JSON.stringify(small));
  await context.close();
}

// 8. No console errors or failed local requests on any route.
// Each route gets its own page and is allowed to settle. Sweeping several
// routes through one tab cancels Vite's in-flight module requests, and those
// surface as ERR_ABORTED on files that are perfectly healthy: real defects were
// being reported alongside pure navigation noise. Aborts are counted separately
// and never fail the check on their own.
{
  const problems = [];
  let aborted = 0;
  for (const route of ROUTES) {
    const { page, context } = await newPage(browser, { width: 390 });
    // External image hosts (Wikimedia car photography, Google Fonts) are blocked
    // by this sandbox's egress policy, and the browser reports each one as a
    // generic "Failed to load resource" console error with no URL attached.
    // Those say nothing about the site: failures that matter are asserted
    // separately below, against local requests only.
    const SANDBOX_EGRESS = /Failed to load resource: net::(ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED_BY_CLIENT)/;
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (SANDBOX_EGRESS.test(text)) return;
      problems.push(`console (${route}): ` + text.slice(0, 120));
    });
    page.on("pageerror", (e) => problems.push(`pageerror (${route}): ` + e.message.slice(0, 120)));
    page.on("requestfailed", (r) => {
      if (!r.url().includes("127.0.0.1")) return;
      if ((r.failure()?.errorText || "").includes("ERR_ABORTED")) aborted++;
      else problems.push(`failed (${route}): ` + r.url().slice(0, 100));
    });
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await context.close();
  }
  record(
    "no console errors across routes",
    problems.length === 0,
    problems.slice(0, 5).join(" | ") + (aborted ? ` [${aborted} navigation aborts ignored]` : ""),
  );
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("failed:");
  for (const f of failed) console.log("  - " + f.name + (f.detail ? ": " + f.detail : ""));
  process.exitCode = 1;
}
