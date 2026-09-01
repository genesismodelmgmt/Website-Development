# West Africa Auto Connect — an importer's walkthrough

> **Filing note:** this document lives in `Website-Development/docs/reviews/` only because that is the web-development workspace available to me. The system reviewed is a separate Lovable project, `west-africa-auto-connect` (id `649a6cb1-98fc-49e4-9cc3-77a39d8680f0`), which trades on the site as **LWD Africa**. No code in this repo relates to it.
>
> **Method and limits.** Everything below is read from the project source through read-only Lovable MCP tools, plus the homepage screenshot returned by `get_project` (which I viewed directly). **I could not reach the live site**: `WebFetch` on both `id-preview--649a6cb1-...lovable.app` and `west-africa-auto-connect.lovable.app` returned `EGRESS_BLOCKED`, and `curl` to the published host was rejected by the egress proxy (`connect_rejected`). So there is **no measured page weight, no Lighthouse score, and no live render** in this review. Every other claim cites a file I actually read. Nothing was submitted, sent, or paid.

---

## Who I am

My name is Ibrahim Bangura. Fifteen years in this trade, out of Freetown. I buy left-hand and right-hand drive out of the UK, Antwerp and Germany and land them at Queen Elizabeth II Quay — sometimes through Conakry, sometimes Monrovia when Freetown is congested. Twenty to forty units a month. Land Cruiser, Prado, Hilux, Corolla, RAV4, some Nissan, some Mercedes, and now more and more of the Chinese cars, because my customers have started asking for them by name.

I do not buy stickers. I buy landed cost. FOB against CIF, RoRo against a 40ft with four units racked inside, NAFI and SLRSA registration, ECOWAS duty, terminal handling, demurrage when the vessel slips, and the clearing agent who wants his envelope. I know what Ghana does to a ten-year-old car and I know Nigeria is a different animal again, and any website that pretends those are the same country will cost somebody money.

Twice I have nearly been taken. Once a "shipping agent" in Essex with a Gmail address and beautiful photographs of a Prado that did not exist. Once a deposit for two Hiluxes that went out and never came back. So my eyes are trained now, and what I look for is boring: a company number, a real street in the UK, the name of a human being, a VIN for each unit, honest maths, a payment route with recourse, and somebody who answers WhatsApp at nine at night. If those seven things are there I will send money to a stranger. If they are not, I will not send a penny to a friend.

A contact sent me this link on WhatsApp. Here is what I found.

## The car I was trying to buy

A 2016–2018 **Toyota Land Cruiser Prado**, left-hand drive, diesel, under 150,000 km, landed Freetown QEII Quay, all-in, with a VIN I can check before I pay. That is a completely ordinary request. It is the single most requested vehicle on my desk.

## What the site actually is, technically

Let me say the important thing first, because everything else follows from it.

**There is no inventory.** There is no database, no stock feed, no unit records. The entire "vehicle directory" is a hand-written TypeScript array — `CARS` in `src/lib/data.ts` — with exactly **87 entries**, each one a *model archetype*, not a car. The type definition tells the whole story:

```
slug, brand, name, series, bodyStyle, powertrain, drive,
rangeKm?, seats, batteryKwh?, power, zeroTo100, highlight, tags, image
```

No year. No mileage. No VIN. No price. No transmission. No engine size. No condition. No location. No registration. Nothing that identifies a physical vehicle. `package.json` confirms it: no Supabase or database client, no Stripe or any payment SDK, no email service. `react-hook-form` and `zod` are installed as shadcn scaffolding but no enquiry form is wired to anything.

**The photographs are Wikimedia Commons.** In `src/lib/data.ts` there is a `wm` object of 57 hot-linked `upload.wikimedia.org` URLs — one per non-BYD model. The 30 BYD models use locally imported JPEGs in `src/assets/cars/`. Then `src/lib/car-galleries.ts` adds up to four more photos per car; its first line reads `// Auto-generated: multiple real Wikimedia Commons photos per car`. I counted **328 URLs, 320 unique, 83 of the 87 slugs covered, 100% Wikimedia hot-links**.

**There is no landed-cost calculator.** `src/components/landed-cost.tsx` is a seven-item prose list — vehicle purchase, export documentation, sea freight, marine insurance, customs and duty, inland delivery, sourcing fee — with **not one number in the file**. It ends in a WhatsApp button.

**There is no enquiry form, deliberately.** The project knowledge (`get_project_knowledge`) instructs: *"Primary conversion = WhatsApp (do NOT build web forms)."* Every "Inquire" button in the app resolves to `waLink()` in `src/lib/contact.ts`, building `https://wa.me/447568765929?text=...` with a pre-filled sentence. Nothing is stored. Nothing is sent. Nothing is recorded.

So: this is a well-built, genuinely handsome **brochure** for a sourcing broker, dressed in the language of a dealership. The build quality is real. The business substance is thin.

## The trust test

Fifteen seconds, from a WhatsApp link, on my phone.

From the screenshot: near-black and gold, "LWD Africa. Private cars, landed.", a G-Wagon filling the screen, VIEW INVENTORY and WHATSAPP QUOTE, then a bar reading **16 / 87+ / 21 / LHD + RHD**, then a strip of 21 manufacturer names. It looks expensive. It does not look like a template. Whoever built this has taste.

And then my second instinct arrives, which is the one that has kept me solvent: *this is exactly what an expensive scam looks like now.* The gold-on-black exporter site with a mobile number and no address is a genre in my inbox. So I go looking for the seven things.

| Trust signal | Present? | Evidence |
|---|---|---|
| UK company registration number | **No** | Absent from `site-nav.tsx` footer, `terms.tsx`, `privacy.tsx`, all JSON-LD |
| VAT number / EORI | **No** | Nowhere in source |
| Physical UK street address | **No** | Footer says only `UK Office · London`; JSON-LD address is `{addressCountry: "GB", addressLocality: "London"}` |
| Named human being | **No** | "Talk to a real person" (`index.tsx` Contact) — names no person anywhere |
| Landline | **No** | Only `+44 7568 765929`, a UK mobile, in `src/lib/contact.ts` |
| WhatsApp | **Yes** | `waLink()`, plus a floating action button on every page |
| Email on the company's own domain | **Partly** | `hello@lwdafrica.com` — but the canonical domain is `lwdcarsafrica.com`. **The email domain and the website domain do not match** |
| Photos of an actual yard, staff, or units | **No** | Every image is Wikimedia stock or a BYD press photo |
| VIN on any vehicle | **No** | No VIN field exists in the `Car` type |
| Prices | **No** | No price field, no price anywhere |
| Terms / Privacy / Cookies | **Yes** | `/terms`, `/privacy`, `/cookies`, `/image-credits` — and they are competently written |
| ICO registration reference | **No** | `privacy.tsx` names LWD Africa as data controller, gives no ICO number or registered address |
| Trade memberships (BIFA, FIATA, IMDA) | **No** | None claimed |
| Reviews / testimonials | **No** | Deliberately — knowledge file says *"Never invent testimonials"* |
| Escrow or buyer-protection mechanism | **No** | No payment layer of any kind exists |

Fifteen of those. Two and a half yes. Now — I want to be fair, and this is important: the *absence* of fake testimonials and invented certifications is itself a mark of honesty. The project knowledge explicitly forbids inventing company registration numbers and addresses, and whoever built this obeyed that. They did not lie. **But a buyer cannot tell the difference between "honestly has no company number on the page" and "has no company".** From Freetown, silence and fraud look identical.

## The walkthrough

**1. First impression.** Covered above. Beautiful, and unverifiable.

**2. The stock.** I clicked VIEW INVENTORY expecting units. `src/routes/cars_.tsx` renders the 87 archetypes as cards showing Power, 0–100 km/h and Seats. *0–100 km/h.* I am buying a truck to run Kenema road, and the site is telling me it does 10.9 seconds to a hundred. Meanwhile it will not tell me the year.

Then I opened the galleries, and this is where I stopped being polite. From `src/lib/car-galleries.ts`:

- **Toyota Land Cruiser 300** — the flagship, in the hero showcase — has a four-photo gallery of which **three are `Formation_lap_at_2019_Suzuka_300km_(16/17/18).jpg`**. Those are motor-racing formation-lap photographs from Suzuka. They are in there because the filename contains the string **"300"**. The fourth is a Hakone Ekiden road-race headquarters car.
- **Toyota Hilux** — gallery is a **1976, two 1979s, and a 1982** Hilux. Forty-five-year-old trucks, sold as the current AN120.
- **Land Rover Defender 110**, listed as series `L663` (the modern one): gallery is a 1997 Defender, a 1990 3.5 V8, one from South Africa, and **`2012_Land_Rover_Defender_110_Skyfall_Film_Car.jpg`** — a James Bond film prop.
- **Mercedes C-Class and E-Class** galleries contain **DTM touring-car racers** (`DTM_Mercedes_W204_Lauda09_amk.jpg`, `DTM_car_mercedes2006_Haekkinen_racing.jpg`).
- **Ten police vehicles** across seven models — Queensland Police Isuzu D-Max, Kia Sorento and Land Cruiser; Zhengzhou police Navara; Singapore Police Tucson; Bangladesh Police L200; Moscow and Préfecture de Police Amaroks — plus **five ambulances and fire appliances**, including Brewster Fire Department trucks under `chevrolet-tahoe`.
- And **`range-rover` and `range-rover-sport` share the identical primary photograph** — `Range_Rover_Sport_Series_III_1X7A7071.jpg` — in `src/lib/data.ts`. Two listings, one picture.

The project's own knowledge file says: *"No random contexts (taxis, police, army, motorsport, concept cars)."* The galleries break that rule about twenty-seven times, and the mechanism is visible: filename keyword matching. Nobody looked at these pictures.

**3. The specific buy.** I went for the Prado. `toyota-prado` exists — series `J250`, the 2024 model. Its gallery: a 2013–2017 Prado front, the same rear, a **Queensland Police Land Cruiser**, and a Prado photographed in Moscow. So the listing claims one generation and shows another, plus a police car.

Can I filter? `src/routes/cars_.tsx` gives me four controls: Drive, Fuel, Brand, free text. **No year. No mileage. No price. No transmission. No new/used.** So my actual brief — 2016–2018, under 150,000 km — cannot be expressed at all.

And the Drive filter, on a company called **L-W-D**:

```js
if (drive !== "all" && c.drive !== drive && c.drive !== "Both") return false;
```

Every car in `data.ts` is either `"LHD"` or `"Both"`. **Not one is `"RHD"`.** So selecting **LHD returns 87 of 87 — it does nothing at all**, and selecting RHD returns the 62 cars marked `"Both"`. The one filter the brand name is built on is a no-op. That is not an opinion, that is arithmetic on the data file.

**4. Landed cost.** This is the only question I have, and the site does not answer it. `landed-cost.tsx` names the seven cost lines correctly — that list *is* right, a real forwarder wrote that structure — and then gives me zero numbers, no RoRo-versus-container comparison, no duty rates, no worked example, and a WhatsApp button.

What it does give me is promises. "One figure, agreed before you commit — **nothing added at the port**" (`landed-cost.tsx`). "**No surprises bolted on at the port**" (`index.tsx`). "your all-in quote includes the current figure so there are **no surprises at the port**" (Nigeria intro, `ship-to.$country.tsx`).

Brother, nobody controls the port. Valuation disputes, terminal handling, a vessel that slips and turns into demurrage — no UK exporter can guarantee that away, and the moment one does, an experienced buyer stops believing the rest of the page. Their own Terms page says the opposite: *"Availability, lead times, sailing schedules and transit estimates are indicative and not guaranteed."*

**5. The countries.** All 16 are there and correctly enumerated — the 15 ECOWAS states plus Mauritania — with real ports, capitals, currencies and transit bands (`src/lib/countries.ts`). Freetown is correctly "Queen Elizabeth II Quay". Mali, Burkina and Niger are correctly routed inland via Dakar/Abidjan/Tema/Lomé/Cotonou. Somebody who knows the region wrote that table. Credit where it is due.

But there is **no country-specific substance behind it**. No age limit anywhere in the codebase. No duty regime. No RHD restriction. `WEST_AFRICAN_COUNTRIES` in `data.ts` carries exactly one attribute per country — `drive: "Left-hand drive"` — identical for all sixteen. Only **four** countries have a hand-written paragraph (Nigeria, Ghana, Sierra Leone, Senegal); the other twelve get a template with the name swapped in. Ghana's paragraph is the only one that mentions age at all — "Ghana applies higher duties on older vehicles" — and even that gives no threshold.

Worse: **the site offers RHD into every country, including Ghana and Nigeria.** The templated intro says *"right-hand drive is available from UK stock on request"* and it is baked into the FAQ JSON-LD served on all sixteen country pages. Ghana and Nigeria both restrict right-hand-drive vehicles on import. Selling me an RHD car for Lagos is selling me a container I cannot clear.

And "Popular exports to Sierra Leone"? `featured = CARS.filter(c => c.drive === "LHD" || c.drive === "Both").slice(0, 6)`. That is the **first six entries in the array — the six Mercedes: G-Class, GLE, S-Class, C-Class, E-Class, GLC**. Identical on all sixteen pages. "Popular exports to Niger" is an S-Class and a C-Class. The paragraph above it says the mainstay is the Land Cruiser, Prado and Hilux, and then shows me six German saloons.

**6. Making contact.** No form, no email submit, no order. Every button opens WhatsApp with a sentence like *"Hi LWD Africa, I'd like a landed door-to-door quote for the Toyota Land Cruiser Prado (Mid-size 4x4, Diesel, LHD or RHD) to Sierra Leone."* Honestly — **this is the right channel and it is well executed.** The destination dropdown in `inquiry-dialog.tsx` pre-fills the country. That is how this trade actually works.

**There is no payment step and no deposit.** No Stripe, nothing. Which means the site cannot defraud anyone, and equally it offers me **no escrow, no staged payment against bill of lading, no buyer protection of any kind** — because the whole money conversation happens off-site, in a WhatsApp thread, with no paper trail on their side. Nothing is logged; there is no CRM. If a buyer disputes what was agreed, there is no record on the company's side either. That protects nobody, in both directions.

**7. Tracking.** None. No shipment status, no B/L reference lookup, no ETA page, no vessel name, nothing. I searched the full route list: `index`, `cars_`, `cars.$slug`, `ship-to.$country`, `privacy`, `terms`, `cookies`, `image-credits`, `sitemap.xml`. That is the entire application. Once my car sails, I am back to WhatsApp voice notes asking "any news?" — which is precisely the five-week window where a first-time buyer decides he has been robbed.

**8. Professional checks.** The engineering here is genuinely careful. `src/components/car-img.tsx` serves a `<picture>` with local WebP at 640w and 1280w from `public/cars/` (174 files present), correct `sizes`, lazy below the fold, hero preloaded with `fetchpriority: high`. Proper work. **Caveat:** gallery photos 2–4 are *not* local — they stream from `upload.wikimedia.org` (`wmSrcSet`), a third party with no CDN presence near Freetown and no guarantee a file still exists tomorrow. I could not measure real bytes because egress was blocked.

**Language:** `<html lang="en">` in `__root.tsx`, no `hreflang`, no i18n anywhere in the file tree — yet the JSON-LD in both `__root.tsx` and `index.tsx` declares `availableLanguage: ["en","fr"]`. Four of the sixteen markets are francophone; Dakar and Abidjan are two of the five destination ports the site names. There is not one word of French. **Currency:** none at all — no GBP, USD or EUR, no prices, no payment methods. **Credentials:** **I found no exposed secrets.** `src/lib/analytics.ts` reads `VITE_GA4_MEASUREMENT_ID` from env, is consent-gated, respects Do Not Track, and no-ops when unset. Clean.

**9. The fraud lens.** A scam exporter site has: gorgeous stock photos of cars it does not own; no company number; no address; a mobile number only; a domain that does not match the email; urgent "in stock" language; and a deposit request. This site matches **six of those seven**, and only escapes the seventh because it has no payment mechanism at all.

I want to be precise about the difference: this is not a scam. It is an honest broker who has accidentally built a page that wears a scammer's clothes. The Terms page tells the truth plainly — *"The models displayed on this site are representative of vehicles we are able to source on your behalf. They are not physical stock held by LWD Africa."* — while the homepage headline says **"Curated stock, export-ready conversations"** and the button says **"View Inventory."** The honesty is buried in the legal page where nobody reads it, and the overclaim is in 60-point type.

**Would I wire a deposit today?** No. Not one leone.

---

## What's genuinely good

- **The WhatsApp-first decision is correct** and executed properly — one `contact.ts` source of truth, context pre-filled with vehicle and destination, tracked, no dead forms.
- **The port/capital/transit table is real knowledge.** QEII Quay, Tin Can and Apapa, Tema, inland routing for the three landlocked states. Someone knew what they were doing.
- **The seven-line landed-cost breakdown is the right structure** — it just needs numbers.
- **The legal pages are honest and competent.** Terms disclaims stock and binding prices; Privacy is a real UK GDPR policy with correct lawful bases; there is a cookie consent gate that actually gates.
- **No invented testimonials, awards, or fake credentials.** Rare, and to their credit.
- **The image pipeline and SEO scaffolding are professionally done** — responsive WebP, preloaded LCP, canonicals, sitemap, structured data.

## Where it breaks down

| # | Severity | What happens | Evidence | What it costs the business |
|---|---|---|---|---|
| 1 | **Critical** | No proof the company exists: no company number, VAT, street address, or named person. Email domain ≠ site domain | `site-nav.tsx` footer (`UK Office · London`); JSON-LD address in `index.tsx`; `EMAIL = "hello@lwdafrica.com"` vs canonical `lwdcarsafrica.com` in `contact.ts` | Every experienced buyer stops here. This alone caps the site at curiosity traffic |
| 2 | **Critical** | Structured data declares `availability: InStock` on all 16 country pages for a business with no stock — contradicting its own Terms | `ship-to.$country.tsx` JSON-LD `Offer`; vs `terms.tsx` "not physical stock held by LWD Africa" | Misrepresentation exposure; Google structured-data penalty risk |
| 3 | **Critical** | Galleries are auto-matched by filename: race cars for the Land Cruiser 300, 1970s trucks for the Hilux, a Bond film prop for the Defender, 10 police vehicles, 5 ambulances | `car-galleries.ts` (`Formation_lap_at_2019_Suzuka_300km`, `1976_Toyota_Hilux`, `Skyfall_Film_Car`, `AU-Q-Police-vehicle_*`) | Reads as scraped. Destroys credibility with exactly the buyer who spends most |
| 4 | **High** | The LHD filter returns 87 of 87 — it does nothing. Zero cars are marked RHD. On a company called LWD | `cars_.tsx` filter predicate; `drive` values in `data.ts` | The brand's core promise is unverifiable in the product |
| 5 | **High** | RHD offered to every country including Ghana and Nigeria, which restrict RHD imports | Templated intro + FAQ JSON-LD in `ship-to.$country.tsx` | A buyer lands a car he cannot register. That is a lawsuit and a dead reputation |
| 6 | **High** | Guarantees the site cannot keep: "nothing added at the port", duty "included" | `landed-cost.tsx`, `index.tsx` WhyLWD, Nigeria/Sierra Leone intros | Contractual exposure; and it reads as amateur to professionals |
| 7 | **High** | "Popular exports to [country]" is the same six Mercedes on all 16 pages | `featured = CARS.filter(...).slice(0, 6)` in `ship-to.$country.tsx` | Immediately exposes the pages as generated, undoing the good port data above them |
| 8 | **Medium** | No landed-cost numbers at all — no calculator, no worked example, no RoRo/container comparison | `landed-cost.tsx` contains no numeric values | Loses the one visitor question worth answering |
| 9 | **Medium** | No tracking after purchase — no B/L, ETA, vessel, or status | Full route list contains no shipment route | Where repeat business is won, and it is empty |
| 10 | **Medium** | Image attribution covers only the 57 primary photos; the ~320 gallery URLs and 30 BYD press photos are uncredited | `image-credits.tsx` filters `CARS` on `c.image` only | CC-BY-SA and manufacturer copyright exposure |
| 11 | **Medium** | Claims French in structured data; site has no French | `availableLanguage: ["en","fr"]` in `__root.tsx`/`index.tsx`; `<html lang="en">`, no i18n | Four francophone markets, two of them named destination ports |
| 12 | **Low** | Keyword stuffing: 55 phrases per vehicle page including "{model} price" and "{model} for sale" with no price and no stock | `keywords` meta in `cars.$slug.tsx` | Modern search engines discount it; humans who view-source do not |

**On #1** — this is the whole review. In this trade trust signals *are* the product. A Companies House number, a real London street address, a landline, and two named faces with a photograph of the yard would move this site further than every other fix combined. The knowledge file forbids *inventing* those, quite rightly. The answer is not to invent them. It is for the owner to supply the real ones.

**On #3** — the Land Cruiser 300 is the single most important vehicle on this site for a West African audience, it is in the hero, and three of its four photos are Suzuka race-track formation laps matched on the string "300". If I show that to another dealer in Freetown we will laugh, and then neither of us will ever open the link again.

**On #5** — I would put this above everything except #1 in terms of real-world harm. Everything else costs a sale. This one costs a customer his money after he has already paid.

---

## From the quayside — Karen Ademola, freight forwarder and customs broker, Tilbury

Twenty years I have moved vehicles to this coast, and I will give the site more credit than Ibrahim did on the logistics, and rather less on the law.

**What they get right.** The RoRo-versus-container framing in the homepage FAQ is accurate — RoRo for a single running unit, container for security, parts and consolidation. The port list is correct and current. The transit bands in `countries.ts` are honest: Freetown at 28–35 days is realistic against a Tilbury or Southampton sailing, and I would rather see that than the fantasy "14 days" some sites print. Cape Verde at 18–24 and Dakar at 20–26 are right, and the 35–45 day bands for Bamako, Ouagadougou and Niamey are honest about inland transit.

**Where the timelines mislead.** Those numbers are *port-to-port sea transit*, but the entire site promises **door-to-door**. Between vessel discharge and a key in a hand there is clearance, examination, duty settlement, possible demurrage and inland haulage — routinely another one to three weeks, longer at Tema or Apapa in a congested month. A buyer reads "28–35 days" and diaries a delivery date. Quote two numbers: sea transit, and estimated total to delivery, with an explicit statement that clearance is outside your control.

**Claims I would strike out.** In order:

1. *"Nothing added at the port"* / *"no surprises at the port"* / duty *"included in the quote"* (`landed-cost.tsx`, `index.tsx`, `ship-to.$country.tsx`). You cannot warrant a destination customs authority's valuation. Replace with: "Your quote includes our current best estimate of destination duty, calculated on [basis]. Duty is assessed by [country] customs on arrival; where the assessment differs from our estimate we pass the difference through at cost, with documentation."
2. *`availability: "https://schema.org/InStock"`* in the country-page JSON-LD. You hold no stock and your own Terms say so. Strike it, or use `PreOrder`. Structured data is a representation like any other.
3. *"Right-hand drive available from UK stock on request"* served to **every** country. Ghana and Nigeria restrict RHD on import. Make the drive-side statement per-country, sourced from that country's current customs rules, and put the date of last verification next to it.
4. *"VIN certifications"* in the Services list (`index.tsx`). That is not a UK export document and I do not know what it means. The real chain is: DVLA notification of permanent export via the V5C, the remainder of the V5C to the buyer, an export declaration on **CDS**, the bill of lading, and where applicable a certificate of origin or ECOWAS certificate. Name the real documents — it is more impressive than the invented one, and it is what tells a professional buyer you have actually done this.
5. *"Marine insurance"* listed as a service you provide. Arranging insurance is an FCA-regulated activity. Either you are authorised, or you are an introducer appointed representative, or you introduce the client to a broker and say so. Get that checked before it appears on a public page again.
6. *"We clear customs at destination"* in sixteen countries. You clear nothing; a licensed broker in each country does. Name them, or say "through our appointed clearing agents".

**The ECOWAS point nobody has updated.** Mali, Burkina Faso and Niger formally withdrew from ECOWAS in January 2025. Any assumption about ECOWAS common external tariff treatment or free circulation on transit through Lomé, Cotonou, Tema or Dakar to those three destinations needs re-checking against what actually applies now. The site says nothing about duty regimes at all, which is safer than saying something wrong — but the moment they add duty guidance, that is the first thing to get right.

**Age limits — the gap that will hurt somebody.** There is not a single age-limit field in this codebase. Ghana penalises over-age vehicles; Nigeria applies its own restriction on used-vehicle age; several others differ again. `countries.ts` has `port`, `capital`, `currency`, `transitDays`. It needs `maxVehicleAge`, `rhdPermitted`, `dutyBasis` and `lastVerified`, populated per country from primary sources and dated on the page. Get that wrong for a client and you have shipped a vehicle that cannot be cleared, and the demurrage clock runs from day one.

**KYC and sanctions — the biggest hole.** There is no buyer verification of any kind: no identity capture, no beneficial-owner check, no sanctions or PEP screening, no end-use question. Consider what is being sold — Land Cruisers, Hiluxes and Patrols, into a region that includes the Sahel, where hard-body 4x4s have a well-documented diversion history. Add UK Money Laundering Regulations (a high value dealer accepting €10,000 or more in cash must register with HMRC), and the fact that the entire commercial conversation happens in an unlogged WhatsApp thread with no record retained.

At minimum, before any deposit: name and address verification against document, sanctions screening of the buyer *and* the consignee (frequently not the same person), an end-user and destination declaration, and a retained file. This is not bureaucracy — it is what stands between the owner and a very bad afternoon.

**What would make me recommend them to a client.** Numbers. One worked landed example — a named model to Freetown, RoRo, each of the seven lines carrying a real figure and a date. That single page would do more for conversion than the entire 87-car directory.

---

## What I'd change, concretely

| Problem | Specific change | Where | How you'd know it worked |
|---|---|---|---|
| No proof of existence | Add a real Companies House number, registered office, landline, and two named staff with photos to a `COMPANY` constant rendered in the footer and the `Organization` JSON-LD | new `src/lib/company.ts`; `site-nav.tsx` `SiteFooter`; `__root.tsx` JSON-LD | The company number resolves on Companies House; the address resolves on Maps |
| Email/domain mismatch | Move to `hello@lwdcarsafrica.com` | `EMAIL` in `src/lib/contact.ts` | Site domain and email domain match |
| False `InStock` | Remove the `Offer`/`availability` block, or set `PreOrder` | `ship-to.$country.tsx` JSON-LD | Rich Results Test shows no stock claim |
| "Curated stock" / "View Inventory" | Reword to "Source list" / "Browse what we source" | `index.tsx` `FeaturedCars`, `Hero`, `SiteNav` | Homepage language matches `terms.tsx` |
| Bad galleries | Delete `car-galleries.ts` wholesale and re-curate by eye — 3 correct-generation photos per model beats 4 wrong ones | `src/lib/car-galleries.ts` | Zero filenames matching police/fire/DTM/race/auction/film |
| Dead LHD filter | Add genuine `RHD`-only entries, or replace the toggle with an honest line: "LHD as standard; RHD sourced to order" | `cars_.tsx`, `data.ts` | LHD and RHD return different, correct counts |
| RHD offered where banned | Add `rhdPermitted: boolean` and `maxVehicleAge` per country; suppress the RHD sentence and the FAQ answer where false | `countries.ts`, `ship-to.$country.tsx` | Ghana and Nigeria pages no longer offer RHD |
| Absolute duty guarantees | Replace all four "no surprises at the port" strings with the estimate-and-pass-through wording above | `landed-cost.tsx`, `index.tsx`, `ship-to.$country.tsx` | No page warrants a third-party authority's decision |
| Identical featured cars | Add a `popular: string[]` per country; Sierra Leone → Prado, Land Cruiser, Hilux, Corolla, RAV4 | `countries.ts`, `ship-to.$country.tsx` | Sierra Leone and Niger show different vehicles |
| No numbers | Add one published worked landed example per major corridor, dated, with an "indicative, verified [date]" stamp | new component beside `landed-cost.tsx` | A visitor can estimate a budget without messaging |
| No tracking | A `/track/$reference` page: vessel, B/L, port, status, next milestone — even manually updated | new route | Buyers stop sending "any news?" voice notes |
| Attribution gap | Extend credits to all gallery URLs and state the licence basis for the 30 BYD photos | `image-credits.tsx` | Credit count matches image count |
| French absent | Either add `/fr` for the four francophone markets, or remove `"fr"` from `availableLanguage` | `__root.tsx`, `index.tsx` | Claim matches reality |

## The five things I'd do first

1. **Put the company on the page — number, registered address, landline, two named faces, one photograph of real stock or a real yard. (S — one afternoon.)** This is the difference between a website and a business people wire money to. Nothing else on this list matters until this is done.
2. **Rip out the auto-generated galleries and hand-pick the photos. (M.)** Race cars, police vehicles and 1976 Hiluxes on your flagship models make you look scraped. This is also the difference between a website and a business people wire money to.
3. **Make the country pages country-specific: RHD permitted yes/no, maximum vehicle age, duty basis, verified date — and stop offering RHD to Ghana and Nigeria. (M.)** Also in that category — this is the one that stops a customer losing money.
4. **Publish one honest worked landed cost, dated, per major corridor, and delete every "no surprises at the port" guarantee. (M.)** This converts. It is also what keeps you out of court.
5. **Add a KYC and sanctions step before any deposit, and a simple shipment-tracking page after it. (L.)** The front of the transaction and the back of it. Right now both are a WhatsApp thread and a prayer.

Items 1, 2 and 3 are the business. Items 4 and 5 are what turns a first sale into a second one.

## What I could not check

- **The live site.** Egress to `id-preview--649a6cb1-*.lovable.app`, `west-africa-auto-connect.lovable.app` and `lwdcarsafrica.com` was blocked by the network proxy (`EGRESS_BLOCKED` / `connect_rejected`). No rendered page, no real page weight, no mobile timing, no Lighthouse. Everything above is source plus the `get_project` screenshot.
- **Actual image byte sizes** shipped to a phone. The `<picture>`/WebP/`sizes` implementation reads correct; I could not weigh it.
- **Whether `lwdcarsafrica.com` is live.** `list_edits` shows a 2026-07-22 commit "Published site to lwdcarsafrica.com", but I could not confirm DNS or a certificate.
- **Whether the WhatsApp number answers**, and whether `@lwdafrica` on X exists (claimed in `__root.tsx`).
- **Whether a real company sits behind this.** There may well be one, with a number and an address, that simply never made it onto the page. That is the most likely explanation and it is a one-afternoon fix.
- **Exact current statutory positions** on RHD import and vehicle age for each of the 16 countries. I have flagged these as issues requiring verification against each national customs authority, not as settled figures — which is precisely what the site must do before publishing any of it.

## Verdict

**Status: Amber**

This is a good-looking, carefully engineered site built on an honest business idea, and it is currently unusable by the buyer it is aimed at: it will not tell me a year, a mileage, a VIN, or a price, its LHD filter does nothing on a company called LWD, and its flagship Land Cruiser is illustrated with photographs of a motor race. Fix the trust block first — company number, address, landline, named people, one photograph of something real — then the galleries, then make the sixteen countries actually different from each other, because right now the site offers right-hand-drive cars to two markets that restrict them. It is Amber and not Red for one reason: nothing here is dishonest, nobody can lose money on it today, and the Terms page tells the truth even where the headline does not — the gap between what this is and what a Freetown buyer would wire a deposit to is about two weeks of focused work, not a rebuild.
