# yourway.ai rebuild, Phase 0 survey and build brief

Date: 18 August 2026. Desk: Genesis AI systems (Rafael Knight, Felix Ward).
Request: total rebuild of yourway.ai so that a visitor can genuinely sign up
and use it as a functional AI.

## Phase 0 survey (read only)

The site lives in the Lovable project `yourway-ai-builder`
(project id `f26b4d88-c196-498b-8f0e-09455b1c8def`), published at
`https://yourway-ai-builder.lovable.app`. Project knowledge names the
canonical public identity AI Your Way at `https://aiyourway.io`.

What already exists, and is worth keeping:

- A full marketing site on the brand system (navy base, blue to purple
  gradient, Inter, calm UK English copy).
- A public three question Try taster with a hardened backend: fail closed
  rate limits, safety gate, no logging of inputs.
- Supabase with a serious schema: memories with lifecycle and sensitivity,
  goals, reflection cycles and answers, nudges with provenance, consent
  events, privacy audit events. RLS enabled and forced everywhere, same
  owner foreign keys, a consent helper function.
- A signed in reflection app: /reflect (nine weekly questions), /goals,
  /today, /you (privacy controls), all consent gated.
- Six typed server functions for the AI core loop against the Lovable AI
  gateway, Zod validated, with prompt versioning and metadata only logging.

What is broken relative to the request:

- The doors are shut. The primary CTA is a waitlist, copy describes a
  private beta, and the free form AI chat was deliberately retired in an
  earlier pass. The signed in surfaces exist but nobody reaches them.
- Usage confirms it: 1 auth user, 0 user profiles, 0 reflection answers,
  0 chat messages, 2 waitlist rows.

Conclusion: reuse beats rebuild. The privacy, safety and data architecture
is good; the rebuild is to open real signup, put a genuinely working
conversational AI at the centre, and repoint the marketing site from
waitlist to sign up. A from scratch rebuild would throw away hardened work
for no gain.

## Build brief sent to the Lovable agent

1. Signup that genuinely works: email and password sign up, sign in and
   password reset at /auth with Supabase email auto confirm on, then a
   short onboarding that creates the profile and seeds candidate memories
   through the consent gated path. Every waitlist primary CTA becomes
   "Create your account". Copy stops claiming a closed beta.
2. A genuinely functional AI at the centre: /chat as the default signed in
   surface, a streaming assistant on the Lovable AI gateway with persistent
   per user conversation history under forced RLS. The system prompt draws
   on confirmed memories, active goals and recent reflection answers via
   the existing retrieveContext function. Candidate memories are offered
   for explicit confirmation, never stored silently. Model calls stay
   server side behind the existing rate limit helper. Weekly synthesis is
   upgraded to a real model pass, evidence only.
3. Quality bar: UK English, no em or en dashes, responsive, working
   loading, empty and error states, clean typecheck and production build.

## Gates observed

- Work stays in preview. Nothing is published to the live site or any
  custom domain; publishing is a Steven approval.
- No destructive operation on the project or its data.
- No fabricated content; copy must match what actually works.
