#!/usr/bin/env node
// Independent acceptance checks for the LWD Africa freight/export expansion.
//
//   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
//     node verify-shipping.mjs
//
// Companion to verify.mjs. Same contract: named checks, PASS/FAIL with the
// measurement that produced the verdict, non-zero exit if anything failed.
// It covers the new /shipping surface AND re-runs the load-bearing fixes from
// the previous piece of work, because the new nav item, hero change and home
// section all touch pages that were already signed off.
//
// Two traps that produced false results last time, guarded throughout:
//   1. `html` has scroll-behavior:smooth, so every programmatic scroll uses
//      behavior:"instant" before anything is sampled. A plain scrollTo animates
//      and the sample reads a page that has barely moved.
//   2. The dev server hydrates a second or two after domcontentloaded and the
//      first click on a fresh page is silently dropped. Every click retries
//      until the state it is supposed to produce actually appears.
//
// Environment:
//   BASE_URL   default http://127.0.0.1:5199
//   ONLY       comma-separated substrings; only matching check groups run
//              (e.g. ONLY=sitemap,dialog node verify-shipping.mjs)

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const BASE = (process.env.BASE_URL || "http://127.0.0.1:5199").replace(/\/$/, "");
const here = dirname(new URL(import.meta.url).pathname);
const fontDir = resolve(here, "fontcache");
const CANONICAL_ORIGIN = "https://lwdcarsafrica.com";

const ONLY = (process.env.ONLY || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const wants = (group) => ONLY.length === 0 || ONLY.some((o) => group.toLowerCase().includes(o));

const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

// ---------------------------------------------------------------------------
// Result recording
// ---------------------------------------------------------------------------
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail, skipped: false });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const skip = (name, reason) => {
  results.push({ name, pass: false, detail: reason, skipped: true });
  console.log(`SKIP  ${name}  — ${reason}`);
};

// ---------------------------------------------------------------------------
// The service catalogue, read from source rather than from the rendered page,
// so a page that quietly drops a service is caught instead of excused.
// ---------------------------------------------------------------------------
function readServices() {
  let src;
  try {
    src = readFileSync(resolve(here, "src/lib/services.ts"), "utf8");
  } catch {
    return { services: [], error: "src/lib/services.ts not found" };
  }
  const services = [];
  const re = /slug:\s*"([a-z0-9-]+)"\s*,\s*(?:\/\*[\s\S]*?\*\/\s*)?name:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) services.push({ slug: m[1], name: m[2] });
  if (!services.length) {
    // Fall back to slugs alone if the file has been reformatted.
    const slugRe = /^\s{4}slug:\s*"([a-z0-9-]+)"/gm;
    while ((m = slugRe.exec(src))) services.push({ slug: m[1], name: "" });
  }
  return { services, error: services.length ? null : "no services parsed from src/lib/services.ts" };
}

const { services: SERVICES, error: servicesError } = readServices();
const SERVICE_PATHS = SERVICES.map((s) => `/shipping/${s.slug}`);
const NEW_ROUTES = ["/shipping", ...SERVICE_PATHS];

// Distinctive words a heading must share with the service name, so "renders its
// own heading" means the right heading rather than any heading.
const distinctive = (svc) => {
  const words = `${svc.name} ${svc.slug.replace(/-/g, " ")}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 4 && !["and", "with", "your", "from", "shipping"].includes(w));
  // "ro-ro" has no long word: fall back to the slug itself, normalised.
  return words.length ? words : [svc.slug.replace(/-/g, " ")];
};

// ---------------------------------------------------------------------------
// Browser plumbing (mirrors verify.mjs so measurements are comparable)
// ---------------------------------------------------------------------------
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

/** Navigate and give the dev server time to hydrate before anything is sampled. */
async function visit(page, path, settle = 600) {
  const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(settle);
  return res;
}

/**
 * Click until the page actually reaches the expected state. The first click on a
 * freshly loaded dev-server page lands before hydration and is dropped.
 */
async function clickUntil(page, locator, predicate, { attempts = 6, timeout = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      await locator.click({ timeout: 3000 });
    } catch {
      /* element may not be interactive yet; the predicate decides */
    }
    const ok = await page
      .waitForFunction(predicate, null, { timeout })
      .then(() => true)
      .catch(() => false);
    if (ok) return true;
  }
  return false;
}

const status = async (path) => {
  try {
    const r = await fetch(BASE + path, { redirect: "manual" });
    return r.status;
  } catch (e) {
    return `ERR ${e.message.slice(0, 40)}`;
  }
};

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------
console.log(`base: ${BASE}`);
if (servicesError) console.log(`note: ${servicesError}`);
console.log(`services parsed: ${SERVICES.length}${SERVICES.length ? " (" + SERVICES.map((s) => s.slug).join(", ") + ")" : ""}\n`);

const hubStatus = await status("/shipping");
const SHIPPING_PRESENT = hubStatus === 200;
record("shipping hub route exists (/shipping returns 200)", SHIPPING_PRESENT, `status ${hubStatus}`);

const browser = await chromium.launch({ args: ["--no-sandbox", "--proxy-bypass-list=127.0.0.1;localhost"] });

// ===========================================================================
// 1. Sitemap: valid XML, complete, and every <loc> resolves.
//    Worth having on its own: a sitemap listing a 404 is worse than no sitemap.
// ===========================================================================
if (wants("sitemap")) {
  const res = await fetch(BASE + "/sitemap.xml");
  const xml = res.ok ? await res.text() : "";
  record("sitemap.xml returns 200 with XML content type", res.ok && /xml/i.test(res.headers.get("content-type") || ""), `status ${res.status}, type ${res.headers.get("content-type")}`);

  // A real XML parse, not a regex: DOMParser reports a parsererror node on
  // malformed input, which a regex over <loc> would sail straight past.
  const { page, context } = await newPage(browser, { width: 1280 });
  const parsed = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) return { ok: false, error: err.textContent.slice(0, 160) };
    const root = doc.documentElement;
    const locs = Array.from(doc.getElementsByTagName("loc")).map((n) => n.textContent.trim());
    return { ok: true, root: root.nodeName, ns: root.namespaceURI, locs };
  }, xml);
  await context.close();

  record(
    "sitemap.xml is well-formed XML with a urlset root",
    parsed.ok && parsed.root === "urlset" && parsed.ns === "http://www.sitemaps.org/schemas/sitemap/0.9",
    parsed.ok ? `root <${parsed.root}> ns ${parsed.ns}, ${parsed.locs.length} <loc>` : parsed.error,
  );

  const locs = parsed.ok ? parsed.locs : [];
  const dupes = locs.filter((l, i) => locs.indexOf(l) !== i);
  record("sitemap has no duplicate <loc>", dupes.length === 0, dupes.slice(0, 5).join(", ") || `${locs.length} unique`);

  const badOrigin = locs.filter((l) => !l.startsWith(CANONICAL_ORIGIN + "/") && l !== CANONICAL_ORIGIN);
  record("every sitemap <loc> is an absolute canonical URL", badOrigin.length === 0, badOrigin.slice(0, 3).join(", ") || `all ${locs.length} on ${CANONICAL_ORIGIN}`);

  // The check that matters: resolve every listed URL against the running app.
  const dead = [];
  for (const loc of locs) {
    const path = loc.replace(CANONICAL_ORIGIN, "") || "/";
    const s = await status(path);
    if (s !== 200) dead.push(`${path} -> ${s}`);
  }
  record(`every sitemap <loc> returns 200 (${locs.length} URLs)`, dead.length === 0, dead.slice(0, 8).join(", ") || `${locs.length}/${locs.length} live`);

  // Completeness: the new surface must actually be listed.
  const listed = new Set(locs.map((l) => l.replace(CANONICAL_ORIGIN, "") || "/"));
  const missing = NEW_ROUTES.filter((p) => !listed.has(p));
  record("sitemap lists /shipping and every service page", missing.length === 0, missing.join(", ") || `${NEW_ROUTES.length} freight URLs listed`);
}

// ===========================================================================
// 2. Every service has a page: 200, its own heading, and headings are distinct.
// ===========================================================================
if (wants("service pages") && SHIPPING_PRESENT) {
  const { page, context } = await newPage(browser, { width: 1280, height: 900 });
  const bad = [];
  const headings = new Map();
  for (const svc of SERVICES) {
    const path = `/shipping/${svc.slug}`;
    const res = await visit(page, path, 500);
    const code = res ? res.status() : 0;
    const h1 = (await page.locator("h1").first().textContent().catch(() => null))?.trim() || "";
    const norm = h1.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const hit = distinctive(svc).some((w) => norm.includes(w));
    if (code !== 200) bad.push(`${path} status ${code}`);
    else if (!h1) bad.push(`${path} no h1`);
    else if (!hit) bad.push(`${path} h1 "${h1.slice(0, 40)}" does not name the service`);
    headings.set(path, h1);
  }
  record(`every service page returns 200 and renders its own heading (${SERVICES.length} services)`, bad.length === 0, bad.slice(0, 6).join(" | ") || `${SERVICES.length}/${SERVICES.length} ok`);

  const seen = new Map();
  for (const [p, h] of headings) {
    if (!h) continue;
    if (seen.has(h)) bad.push(`${p} shares h1 with ${seen.get(h)}`);
    seen.set(h, p);
  }
  const shared = [...headings.entries()].filter(([, h]) => h && [...headings.values()].filter((x) => x === h).length > 1);
  record("service page headings are distinct from one another", shared.length === 0, shared.map(([p, h]) => `${p}="${h}"`).slice(0, 4).join(" | ") || `${headings.size} distinct`);

  // Unknown slug: the not-found page, not a blank screen and not a crash.
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 100)));
  const res = await visit(page, "/shipping/definitely-not-a-service", 700);
  const nf = await page.evaluate(() => ({
    text: (document.body.innerText || "").trim(),
    // Any same-origin link out is a valid recovery path: the existing
    // /ship-to not-found sends you home, D's sends you back to /shipping.
    recovery: Array.from(document.querySelectorAll('a[href^="/"]')).map((a) => a.getAttribute("href")),
  }));
  const code = res ? res.status() : 0;
  const looksNotFound = /not found|404|doesn.t exist/i.test(nf.text);
  record(
    "unknown service slug renders the not-found page",
    code === 404 && looksNotFound && nf.text.length > 20 && nf.recovery.length > 0 && pageErrors.length === 0,
    `status ${code}, ${nf.text.length} chars, notFoundWording=${looksNotFound}, recovery links ${JSON.stringify(nf.recovery)}${pageErrors.length ? ", pageerror: " + pageErrors[0] : ""}`,
  );
  await context.close();
} else if (wants("service pages")) {
  skip("every service page returns 200 and renders its own heading", "/shipping not built yet");
  skip("unknown service slug renders the not-found page", "/shipping not built yet");
}

// ===========================================================================
// 3. No horizontal overflow anywhere on the new surface, at every width.
// ===========================================================================
if (wants("overflow") && SHIPPING_PRESENT) {
  for (const width of WIDTHS) {
    const { page, context } = await newPage(browser, { width });
    const bad = [];
    for (const route of NEW_ROUTES) {
      await visit(page, route, 500);
      const o = await page.evaluate(() => {
        // Name the widest offender so the report is actionable rather than a
        // bare number: an element wider than the viewport is the usual cause.
        const de = document.documentElement;
        let worst = null;
        if (de.scrollWidth > de.clientWidth) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            const over = Math.round(r.right - de.clientWidth);
            if (over > 1 && (!worst || over > worst.over)) {
              worst = { over, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40) };
            }
          }
        }
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, worst };
      });
      if (o.scrollW > o.clientW) {
        bad.push(`${route} ${o.scrollW}>${o.clientW}${o.worst ? ` (${o.worst.tag}.${o.worst.cls} +${o.worst.over}px)` : ""}`);
      }
    }
    record(`no horizontal overflow on freight routes @${width}`, bad.length === 0, bad.slice(0, 3).join(", ") || `${NEW_ROUTES.length} routes clean`);
    await context.close();
  }
} else if (wants("overflow")) {
  for (const width of WIDTHS) skip(`no horizontal overflow on freight routes @${width}`, "/shipping not built yet");
}

// ===========================================================================
// 4. Every internal link on the new pages resolves to 200.
// ===========================================================================
if (wants("links") && SHIPPING_PRESENT) {
  const { page, context } = await newPage(browser, { width: 1280, height: 900 });
  const found = new Map(); // path -> first page that linked to it
  for (const route of NEW_ROUTES) {
    await visit(page, route, 500);
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.getAttribute("href"))
        .filter(Boolean),
    );
    for (const raw of hrefs) {
      if (/^(mailto:|tel:|sms:|https?:\/\/(?!127\.0\.0\.1|localhost)|whatsapp:|#)/i.test(raw)) continue;
      let path = raw.replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/, "");
      path = path.split("#")[0];
      if (!path) continue;
      if (!path.startsWith("/")) continue; // relative link: report separately
      if (!found.has(path)) found.set(path, route);
    }
  }
  const dead = [];
  for (const [path, from] of found) {
    const s = await status(path);
    if (s !== 200) dead.push(`${path} -> ${s} (linked from ${from})`);
  }
  record(`every internal link on the freight pages resolves to 200 (${found.size} targets)`, dead.length === 0, dead.slice(0, 8).join(" | ") || `${found.size}/${found.size} live`);
  await context.close();
} else if (wants("links")) {
  skip("every internal link on the freight pages resolves to 200", "/shipping not built yet");
}

// ===========================================================================
// 5. The freight quote dialog.
// ===========================================================================
if (wants("dialog") && SHIPPING_PRESENT) {
  const OPENER = /freight quote|get a quote|request a quote|start a quote|quote/i;

  for (const [w, h] of [
    [320, 844],
    [390, 600],
  ]) {
    const { page, context } = await newPage(browser, { width: w, height: h });
    await visit(page, "/shipping", 900);

    // Find the opener: a button (not a link to another page) whose accessible
    // name mentions a quote. Tag it so focus return can be verified by identity.
    const openerInfo = await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const cands = Array.from(document.querySelectorAll("button, [role=button]")).filter((b) => {
        const r = b.getBoundingClientRect();
        const label = (b.textContent || b.getAttribute("aria-label") || "").trim();
        return r.width > 0 && r.height > 0 && re.test(label) && !b.closest("[role=dialog]");
      });
      if (!cands.length) return null;
      const el = cands[0];
      el.setAttribute("data-vf-opener", "1");
      return { text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40), count: cands.length };
    }, OPENER.source);

    if (!openerInfo) {
      record(`freight quote dialog opens @${w}x${h}`, false, "no visible button naming a quote found on /shipping");
      await context.close();
      continue;
    }

    const opened = await clickUntil(
      page,
      page.locator("[data-vf-opener]"),
      () => !!document.querySelector('[role=dialog][data-state=open], [role=dialog]:not([hidden])'),
    );
    record(`freight quote dialog opens @${w}x${h}`, opened, opened ? `opener "${openerInfo.text}" (${openerInfo.count} candidates)` : `clicked "${openerInfo.text}" 6x, no [role=dialog] appeared`);

    if (!opened) {
      await context.close();
      continue;
    }
    await page.waitForTimeout(500);

    // Fully reachable: the dialog fits horizontally, and every focusable control
    // in it (first and last) can be scrolled into the viewport.
    const reach = await page.evaluate(() => {
      const d = document.querySelector("[role=dialog]");
      const r = d.getBoundingClientRect();
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
      const focusables = Array.from(d.querySelectorAll(sel)).filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== "hidden";
      });
      const probe = (el) => {
        // behavior:"instant" — html is scroll-behavior:smooth and a smooth scroll
        // would be sampled mid-animation.
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
        const b = el.getBoundingClientRect();
        return {
          label: (el.textContent || el.getAttribute("aria-label") || el.name || el.tagName).trim().slice(0, 24),
          top: Math.round(b.top),
          bottom: Math.round(b.bottom),
          inView: b.top >= -1 && b.bottom <= window.innerHeight + 1 && b.left >= -1 && b.right <= window.innerWidth + 1,
        };
      };
      const first = focusables.length ? probe(focusables[0]) : null;
      const last = focusables.length ? probe(focusables[focusables.length - 1]) : null;
      const de = document.documentElement;
      return {
        count: focusables.length,
        first,
        last,
        fitsH: r.left >= -1 && r.right <= window.innerWidth + 1,
        rect: { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) },
        vw: window.innerWidth,
        vh: window.innerHeight,
        docOverflow: de.scrollWidth > de.clientWidth ? `${de.scrollWidth}>${de.clientWidth}` : null,
      };
    });
    const reachable = reach.count > 0 && reach.fitsH && !reach.docOverflow && reach.first?.inView && reach.last?.inView;
    record(
      `freight quote dialog is fully reachable @${w}x${h}`,
      reachable,
      `${reach.count} focusables, first "${reach.first?.label}" ${reach.first?.inView ? "reachable" : "OFF-SCREEN " + reach.first?.top}, last "${reach.last?.label}" ${reach.last?.inView ? "reachable" : "OFF-SCREEN " + reach.last?.bottom + "/" + reach.vh}, dialog ${reach.rect.l}..${reach.rect.r} of ${reach.vw}${reach.docOverflow ? ", doc overflow " + reach.docOverflow : ""}`,
    );

    // Escape closes, and focus goes back to the element that opened it.
    await page.keyboard.press("Escape");
    const closed = await page
      .waitForFunction(() => !document.querySelector("[role=dialog]"), null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    record(`freight quote dialog closes on Escape @${w}x${h}`, closed, closed ? "" : "[role=dialog] still in the DOM 3s after Escape");

    if (closed) {
      await page.waitForTimeout(400);
      const focus = await page.evaluate(() => {
        const a = document.activeElement;
        return {
          isOpener: !!(a && a.getAttribute && a.getAttribute("data-vf-opener") === "1"),
          tag: a ? a.tagName.toLowerCase() : "none",
          text: a ? (a.textContent || "").trim().slice(0, 30) : "",
        };
      });
      record(`freight quote dialog returns focus to its opener @${w}x${h}`, focus.isOpener, `focus on <${focus.tag}> "${focus.text}"`);
    } else {
      skip(`freight quote dialog returns focus to its opener @${w}x${h}`, "dialog never closed");
    }
    await context.close();
  }
} else if (wants("dialog")) {
  for (const [w, h] of [[320, 844], [390, 600]]) {
    skip(`freight quote dialog opens @${w}x${h}`, "/shipping not built yet");
    skip(`freight quote dialog is fully reachable @${w}x${h}`, "/shipping not built yet");
    skip(`freight quote dialog closes on Escape @${w}x${h}`, "/shipping not built yet");
    skip(`freight quote dialog returns focus to its opener @${w}x${h}`, "/shipping not built yet");
  }
}

// ===========================================================================
// 6. Touch targets on the new pages are at least 44px on a phone.
// ===========================================================================
if (wants("touch") && SHIPPING_PRESENT) {
  const { page, context } = await newPage(browser, { width: 390 });

  // Controls, not prose links: buttons, and anchors styled as buttons or sitting
  // on their own outside a paragraph. Zoned, because the header and footer are
  // shared chrome that predates this work: a failure there is site-wide, not a
  // freight-page defect, and conflating the two would let a real new offender
  // hide inside a known one. /cars is measured as the baseline for that claim.
  const measure = () =>
    page.evaluate(() => {
      const sel = 'header button, header a[href], footer button, footer a[href], button, a[class*="btn"], select, input:not([type=hidden])';
      return Array.from(document.querySelectorAll(sel))
        .filter((el) => !el.closest("p") && !el.closest("[role=dialog]"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            zone: el.closest("header") ? "chrome" : el.closest("footer") ? "chrome" : "content",
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24),
            h: Math.round(r.height),
            w: Math.round(r.width),
          };
        })
        .filter((x) => x.h > 0 && x.w > 0 && x.h < 44);
    });

  await visit(page, "/cars", 800);
  const baseline = await measure();
  const baselineChrome = baseline.filter((x) => x.zone === "chrome");
  const baselineContent = baseline.filter((x) => x.zone === "content");

  const contentBad = [];
  const chromeBad = new Map();
  for (const route of ["/shipping", ...SERVICE_PATHS.slice(0, 3)]) {
    await visit(page, route, 800);
    for (const s of await measure()) {
      const line = `<${s.tag}> "${s.text}" ${s.w}x${s.h}`;
      if (s.zone === "content") contentBad.push(`${route} ${line}`);
      else chromeBad.set(line, true);
    }
  }
  record(
    "freight page content controls are >=44px tall on a phone",
    contentBad.length === 0,
    (contentBad.slice(0, 8).join(" | ") || "all content controls >=44px") +
      `  [baseline: /cars has ${baselineContent.length} content controls under 44px, e.g. ${baselineContent
        .slice(0, 2)
        .map((x) => `"${x.text}" ${x.w}x${x.h}`)
        .join(", ")}]`,
  );
  record(
    "shared header/footer controls are >=44px tall on a phone",
    chromeBad.size === 0,
    [...chromeBad.keys()].slice(0, 6).join(" | ") +
      (chromeBad.size ? `  [PRE-EXISTING: /cars shows ${baselineChrome.length} of the same]` : "none under 44px"),
  );
  await context.close();
} else if (wants("touch")) {
  skip("freight page content controls are >=44px tall on a phone", "/shipping not built yet");
  skip("shared header/footer controls are >=44px tall on a phone", "/shipping not built yet");
}

// ===========================================================================
// 6b. Discoverability basics on every freight page: a self-referencing
//     canonical, a unique title and a description. Two pages sharing a title or
//     a canonical is how a new section cannibalises itself.
// ===========================================================================
if (wants("meta") && SHIPPING_PRESENT) {
  const { page, context } = await newPage(browser, { width: 1280, height: 900 });
  const seenTitle = new Map();
  const seenCanon = new Map();
  const bad = [];
  for (const route of NEW_ROUTES) {
    await visit(page, route, 400);
    const m = await page.evaluate(() => ({
      title: document.title || "",
      desc: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      canon: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      canonCount: document.querySelectorAll('link[rel="canonical"]').length,
      h1: document.querySelectorAll("h1").length,
    }));
    const expected = CANONICAL_ORIGIN + route;
    if (!m.title) bad.push(`${route} no title`);
    if (!m.desc) bad.push(`${route} no description`);
    if (m.canon !== expected) bad.push(`${route} canonical "${m.canon}" != ${expected}`);
    if (m.canonCount !== 1) bad.push(`${route} ${m.canonCount} canonical tags`);
    if (m.h1 !== 1) bad.push(`${route} ${m.h1} h1 elements`);
    if (seenTitle.has(m.title)) bad.push(`${route} shares title with ${seenTitle.get(m.title)}`);
    if (seenCanon.has(m.canon)) bad.push(`${route} shares canonical with ${seenCanon.get(m.canon)}`);
    seenTitle.set(m.title, route);
    seenCanon.set(m.canon, route);
  }
  record(
    `every freight page has a unique title and a self-referencing canonical (${NEW_ROUTES.length} pages)`,
    bad.length === 0,
    bad.slice(0, 8).join(" | ") || `${NEW_ROUTES.length} pages, all distinct`,
  );
  await context.close();
} else if (wants("meta")) {
  skip("every freight page has a unique title and a self-referencing canonical", "/shipping not built yet");
}

// ===========================================================================
// 7. No console errors and no failed local requests across the new routes.
// ===========================================================================
if (wants("console") && SHIPPING_PRESENT) {
  // Each route gets its own page and is allowed to settle before the next one
  // loads. Navigating away from a Vite dev page cancels whatever ES modules were
  // still in flight, and those cancellations surface as net::ERR_ABORTED on
  // perfectly healthy files: sweeping all eleven routes through one tab reports
  // the harness, not the site. ERR_ABORTED is therefore counted separately from
  // a genuine failure (connection refused, 404, ERR_FAILED) and never fails the
  // check on its own.
  //
  // Console errors and page errors are listed FIRST and in full: a truncated
  // list that spends its budget on request noise can hide a hydration warning.
  const consoleErrors = new Set();
  const realFailures = new Set();
  const aborted = new Set();
  for (const route of NEW_ROUTES) {
    const { page, context } = await newPage(browser, { width: 390 });
    // The freight photography and Google Fonts live on hosts this sandbox
    // blocks, and the browser reports each blocked load as a generic "Failed to
    // load resource" console error carrying no URL. That says nothing about the
    // site: the requests that matter are asserted below, against local URLs
    // only. Without this filter the check fails on every run for a reason that
    // will not exist in production, which trains everyone to ignore it.
    const SANDBOX_EGRESS =
      /Failed to load resource: net::(ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED_BY_CLIENT|ERR_PROXY_CONNECTION_FAILED)/;
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (SANDBOX_EGRESS.test(text)) return;
      consoleErrors.add(`${route}  ${text.slice(0, 150)}`);
    });
    page.on("pageerror", (e) => consoleErrors.add(`${route}  pageerror: ${e.message.slice(0, 150)}`));
    page.on("requestfailed", (r) => {
      const u = r.url();
      if (!u.includes("127.0.0.1") && !u.includes("localhost")) return;
      const err = r.failure()?.errorText || "";
      const line = `${err} ${u.replace(/\?v=[a-f0-9]+/, "?v=…").slice(22, 140)}`;
      (err === "net::ERR_ABORTED" ? aborted : realFailures).add(line);
    });
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await context.close();
  }
  const problems = [...consoleErrors, ...realFailures];
  record(
    `no console errors or failed local requests on the freight routes (${NEW_ROUTES.length} routes)`,
    problems.length === 0,
    problems.slice(0, 6).join(" | ") ||
      `clean${aborted.size ? ` (${aborted.size} net::ERR_ABORTED dev-module cancellations ignored)` : ""}`,
  );
} else if (wants("console")) {
  skip("no console errors or failed local requests on the freight routes", "/shipping not built yet");
}

// ===========================================================================
// 8. Regressions: the previous fixes must still hold, including on the pages
//    Agent E touched (home hero, home freight section, nav, footer, /cars).
// ===========================================================================
if (wants("regression")) {
  // 8a. First visit does not scroll away from the hero.
  for (const route of SHIPPING_PRESENT ? ["/", "/cars", "/shipping"] : ["/", "/cars"]) {
    for (const width of [390, 1440]) {
      const { page, context } = await newPage(browser, { width, consent: null });
      await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
      const trace = [];
      for (let i = 0; i < 10; i++) {
        trace.push(await page.evaluate(() => Math.round(window.scrollY)));
        await page.waitForTimeout(250);
      }
      const max = Math.max(...trace);
      record(`first visit stays at top on ${route} @${width}`, max === 0, `max scrollY ${max} (${trace.join(" ")})`);
      await context.close();
    }
  }

  // 8b. The mobile drawer covers the viewport below the header, on the new page too.
  for (const route of SHIPPING_PRESENT ? ["/cars", "/shipping"] : ["/cars"]) {
    for (const width of [320, 375, 390, 430, 768]) {
      const { page, context } = await newPage(browser, { width });
      await visit(page, route, 600);
      const opened = await clickUntil(
        page,
        page.getByRole("button", { name: /open menu/i }),
        () => document.querySelector("header button[aria-expanded]")?.getAttribute("aria-expanded") === "true",
      );
      if (!opened) {
        record(`drawer covers viewport on ${route} @${width}`, false, "menu never opened");
        await context.close();
        continue;
      }
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const drawer = document.getElementById("site-nav-mobile");
        if (!drawer) return { err: "no #site-nav-mobile" };
        const r = drawer.getBoundingClientRect();
        const scrim = drawer.firstElementChild.getBoundingClientRect();
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
      record(`drawer covers viewport on ${route} @${width}`, covers, JSON.stringify(m));
      await context.close();
    }
  }

  // 8c. Anchors land clear of the sticky header.
  for (const width of [390, 1440]) {
    const { page, context } = await newPage(browser, { width });
    await visit(page, "/", 600);
    const ids = await page.evaluate(() =>
      ["services", "destinations", "process", "contact", "freight", "shipping"].filter((i) => document.getElementById(i)),
    );
    const bad = [];
    for (const id of ids) {
      await page.evaluate((i) => {
        location.hash = "";
        location.hash = i;
      }, id);
      await page.waitForTimeout(900);
      const r = await page.evaluate((i) => {
        const s = document.getElementById(i);
        const header = document.querySelector("header");
        return { top: Math.round(s.getBoundingClientRect().top), headerH: Math.round(header.getBoundingClientRect().height) };
      }, id);
      if (r.top < r.headerH - 2) bad.push(`#${id} top ${r.top} < header ${r.headerH}`);
    }
    record(`anchors clear the sticky header @${width}`, bad.length === 0, bad.join(", ") || `${ids.length} anchors: ${ids.join(", ")}`);
    await context.close();
  }
}

await browser.close();

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass && !r.skipped);
const skipped = results.filter((r) => r.skipped);
const passed = results.filter((r) => r.pass);
console.log(`\n${passed.length}/${results.length - skipped.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ""}`);
if (skipped.length) {
  console.log("skipped (not verified, not excused):");
  for (const s of skipped) console.log("  - " + s.name + ": " + s.detail);
}
if (failed.length) {
  console.log("failed:");
  for (const f of failed) console.log("  - " + f.name + (f.detail ? ": " + f.detail : ""));
}
if (failed.length || skipped.length) process.exitCode = 1;
