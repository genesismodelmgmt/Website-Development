Sent to the genesismm Lovable project to get the portal sign in code delivering,
after finding the email pipeline in a worse state than expected.

## The brief

Diagnose before changing anything: work out why email_send_log showed 147
pending and 298 dlq against 105 sent. Report the root cause with evidence, do
not guess, do not paper over it with a retry. Do not mass replay the historic
backlog. Do not add a new external provider and do not request any credential.

Then route the portal sign in code through the project's own email system
rather than configuring Supabase SMTP: mint the code server side with
auth.admin.generateLink, send it through the existing transactional path, and
leave verifyOtp on step two untouched so Supabase stays the session authority.
Step one must look identical for a known and an unknown address, and the code
must never reach email_send_log.

## What the diagnosis actually found

My reading of the numbers was half wrong, and the agent corrected it.

- The 147 pending rows were NOT a stuck backlog. Every pending message id also
  carries a terminal sent or dlq row: the log was being written twice per
  message and the pending row never resolved. Verified independently with SQL:
  156 pending message ids, 156 with a terminal row, 0 genuinely unresolved.
- The 298 dlq rows were real, and 293 of them are
  "403 domain_not_verified" for notify.genesismodelmgmt.co.uk, running from
  3 July to 11 August. A verified fallback sender landed on 11 August and there
  has been no dlq on any day since, with sends every day.
- A genuine unseen defect: retries reused the same provider idempotency key, so
  after any first failure the provider returned 409 forever, guaranteeing five
  failures and a dead letter.
- No cron was missing. Wake triggers on the queue tables schedule the processor
  on enqueue, proven live.

## Changes

Queue processor resolves the pending row in place instead of inserting a second
row, and retries now carry a per attempt idempotency key. Portal sign in mints
the code with generateLink and sends it through the project queue, with a
Genesis branded template. A deliberate single message replay by id was added,
with no mass replay.

Note: this project's Supabase mints eight digit codes, not six, so the field and
copy were corrected to match rather than silently rejecting valid codes.

## Verified

Three real sends to contact@genesismodelmgmt.co.uk, all status sent, metadata
carrying only {"purpose":"portal_sign_in"} with no code. Typecheck clean,
144/144 tests passing. PORTAL_PUBLIC_ENTRY still false.

## Still outstanding, needs DNS access

Mail currently leaves as notify.aiyourway.io, an unrelated domain from another
project in the workspace. notify.genesismodelmgmt.co.uk is still unverified,
which is what caused 293 dead letters in the first place. Verifying it needs
DNS records on genesismodelmgmt.co.uk.
