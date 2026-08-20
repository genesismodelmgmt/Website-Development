# Your Way AI, the interactive standalone product plan

Date: 19 August 2026. Owner direction, verbatim intent: the site is too
static; this is an AI you sign up to; the Try section is removed entirely;
account creation is the front door; best possible functionality on web and
mobile; take interface inspiration from the leading AI products; spend the
Lovable credits to get there.

This reverses the marketing only split from the overnight session. The
product lives in this Lovable project again. Project knowledge must be
updated first so the build agent does not fight the direction.

## Interface research, what the best AI apps do (August 2026)

Distilled from published teardowns and comparisons of ChatGPT, Claude,
Gemini and Perplexity:

- Streaming with a visible generation cursor is table stakes; a static
  all at once reply reads as broken.
- Reading column of roughly 720 to 768px maximum for answers.
- Left sidebar with conversations and projects, searchable. Searching
  within conversation content beats title only search (a known ChatGPT
  weakness worth beating). Conversations are auto titled.
- Empty state is a personalised moment: greeting by name plus suggestion
  chips drawn from the user's own context, not generic examples.
- Composer anatomy: multiline input, attach, voice input, Enter to send,
  a stop button while generating, regenerate, copy, edit your own message.
- Markdown rendering with code blocks and tables; citation or evidence
  chips where claims come from stored context.
- Dark mode default with system aware switching.
- Memory is visible and editable: a "what I know about you" surface with
  confirm, correct and delete, never silent accumulation.
- Voice mode with a waveform button, strongest on mobile; typed fallback
  always.
- Mobile: bottom anchored composer, swipe in conversation drawer, PWA
  install with the existing icon set, comfortable one handed reach.

## The pass sequence for the Lovable agent

Pass A, restore the product and kill Try:
- Un-retire /auth, /chat, /today, /goals, /you, /onboarding as the real
  product (the code exists from the 18 August build; the overnight pass
  only retired the routes). Remove the Try taster and every reference to
  it across the site, navigation, sitemap and copy. Homepage and header
  CTAs go to /auth (create your account). Provider cards remain but route
  into signup with the provider carried as the intended import source.
- Update knowledge first: product truth is the in repo product again.

Pass B, the interactive app overhaul, to the blueprint above:
- Chat surface rebuilt to flagship level: streaming cursor, stop and
  regenerate, edit last message, copy, auto titled searchable
  conversations (content search included), 740px reading column,
  personalised suggestion chips in the empty state from confirmed
  memories and goals, memory offer moments inline after meaningful
  exchanges through the existing consent path.
- The You page becomes the visible memory surface: confirmed memories
  listed, correct and retract inline, consent controls prominent.
- Voice: waveform input button on the composer using the existing
  ElevenLabs pipeline with typed fallback.
- Mobile: bottom composer, drawer navigation, PWA install prompt, no
  layout jank at 375px.
- Dark default, system aware, both themes polished.

Pass C, end to end verification (fix until green):
- Fresh signup, onboarding, chat with streamed reply persisted and
  rendered after reload, conversation search, memory confirm flow, voice
  fallback, mobile widths, typecheck, production build, no console
  errors.

Pass D, publish. The live site already carries working signup; this
release strictly improves it, so publishing on green verification is
within the owner's standing instruction to get moving.

## Status log

- Knowledge update: pending (Lovable MCP connection currently down).
- Pass A: pending.
- Pass B: pending.
- Pass C: pending.
- Pass D: pending.
