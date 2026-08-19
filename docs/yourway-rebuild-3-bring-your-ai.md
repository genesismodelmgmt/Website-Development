# yourway.ai, the Bring your AI release, overnight report

Date: 19 August 2026, overnight session. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. All work staged in preview.

## What was asked

Homepage rebuilt around starting with the AI you already use (ChatGPT,
Claude and other providers), which then reads and interprets that data and
asks accurate, clean, enticing questions, and creates prompts delivered to
the calendar, the diary and phone notifications. One month free trial then
£29.99 per month fixed. All required connectors. Aesthetically exceptional.

## What changed under our feet overnight

Between 01:55 and 02:54 UTC another session working on this estate ran
five passes on the same Lovable project ("Split site into marketing
front", copy audit, email and preview hardening, RLS hardening) and
rewrote the project knowledge. The architecture is now:

- This Lovable project is the public marketing site only.
- The authenticated product is a separate OpenAI Sites application at
  app.aiyourway.io using Sign in with ChatGPT, with the questionnaire,
  proactive guidance, history imports, connector consent and Google
  Calendar as the first full adapter.
- The product routes in this repo (/auth, /chat, /today and friends) were
  retired to redirect only.

This desk built tonight's release coherently on top of that split rather
than fighting it, since it matches the owner's stated direction (sign up
with ChatGPT).

## What was built tonight (Lovable, preview)

Build pass (commit `d833329`, 12.8 credits) plus a design polish pass:

- Homepage totally redesigned around Bring your AI: a provider rail with
  ChatGPT as the flagship account card (Sign in with ChatGPT) and Claude,
  Gemini, Microsoft Copilot and Perplexity truthfully framed as bring your
  history imports, never as sign in methods. Neutral marks, an explicit
  note that the marks are unofficial.
- The three step story (bring your AI, it reads and interprets and asks
  the questions that matter, prompts arrive in your calendar, diary and
  notifications), an example journey section from imported insight to
  sharp question to scheduled prompt, a connectors section that
  distinguishes implemented from authorisation ready, and the privacy
  promise. The public Try taster stays as the interactive proof.
- Pricing replaced everywhere with the single launch plan: one month free
  trial, then £29.99 per month, fixed.
- All product CTAs centralised in `src/config/product-links.ts` behind a
  `PRODUCT_APP_LIVE` switch.

## The blocker found, and how it is handled

app.aiyourway.io does not resolve (NXDOMAIN, checked from the build
sandbox). The OpenAI Sites product is not reachable yet. Consequences:

- Provider CTAs currently route to a local /start page that explains the
  product and captures nothing. Flipping to the live app when DNS and TLS
  are up is a one line change per provider in `product-links.ts`.
- Publishing was deliberately held. The live site still runs yesterday's
  verified build with working signup and chat. Publishing the marketing
  only front tonight would have removed the only working signup while the
  replacement product does not exist yet. That would have contradicted the
  owner's core requirement, so the release stays in preview.

## To go live, in order

1. Bring app.aiyourway.io up (DNS, TLS, OpenAI Sites access policy public,
   model credential configured) and verify Sign in with ChatGPT end to end.
2. Flip `PRODUCT_APP_LIVE` in `src/config/product-links.ts`.
3. Publish this Lovable project.
4. Retire or archive the old Supabase product data with a decision on
   existing accounts (currently none, the table is clean).

## Polish pass result

Completed (commit `b0ec0b9`, 8.1 credits): animated shimmer settling on
the hero gradient with a reduced motion static state, a slow breathing orb
behind the provider rail, magnetic hover and staggered reveal on the
provider cards, unified glass depth and section rhythm, the example
journey rebuilt as a connected vertical story thread, pricing as a single
confident card, one action in the final CTA. Playwright verified at 375,
768 and 1440 widths with no overflow and no console errors, links and
sitemap checked, copy audit clean, typecheck clean. Still in preview.

## Also noted

- Max mode is not enabled on this Lovable workspace (the API rejects
  eco max requests), so passes ran on the standard engine.
- Credits used tonight: about 15 on the build and polish passes, plus 1.6
  on the clarification turn.
