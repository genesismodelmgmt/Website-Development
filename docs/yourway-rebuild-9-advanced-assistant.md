# yourway.ai, advanced assistant release

Date: 24 August 2026. Desk: Genesis AI systems.
Project: Lovable `yourway-ai-builder`. Commit `305d470` (21.1 credits).
Published as deployment `033d3f1c-5aa2-407c-892e-ee44281bd868`.

## Purpose

Move the assistant beyond a streaming chat with context pasted into a
prompt. Four real capability upgrades, each proven with data rather than
asserted.

## What shipped

1. Semantic retrieval, replacing keyword matching. pgvector with an HNSW
   index, embeddings written for history chunks and confirmed memories,
   similarity search with a relevance floor blended with recency, and a
   backfill for anything already stored.
2. Model routing. Three tiers, reasoning, balanced and fast, chosen by
   the shape of the request, whether an image is present and the length
   of the thread. Only the tier name is logged, never content.
3. Tool use, scoped strictly to the person's own account:
   `search_my_context`, `propose_memory`, `upsert_goal`,
   `confirm_next_action`, `schedule_prompt`, `read_document`. Nothing
   reaches outside the account and nothing is ever sent on their behalf.
4. Vision and private image attachments in a `chat_images` table, plus
   rolling conversation summaries so long threads keep their thread
   instead of being truncated.

Control signals for status, tool use and tier are framed out of band so
they cannot leak into the visible reply.

## Verification, independent

Checked in the live database by this desk, not taken from the report.
Test account `advanced+1787588559776@example.com`:

- All five history chunks carried embeddings, so retrieval is genuinely
  vector based.
- The decisive semantic test: asked "which northern Portuguese city did I
  settle on for the storage side of the shipping venture, and why", the
  assistant answered Porto for Project Thistledown, citing the cheaper
  warehouse lease and the shorter drive to the packing site. The source
  text says Porto and warehouse; the question says northern Portuguese
  city and storage. Keyword matching could not bridge that gap.
- Tool use genuinely executed: a natural language request produced a real
  `daily_nudges` row, "Chase missing insurance certificate", for
  2 September, morning, and a VEVENT in the private calendar feed.
- The consent gate held: `propose_memory` left the memory as a candidate,
  not confirmed, so nothing was stored without explicit confirmation.
- Two images were stored privately for the vision path.

The message history also records the honest before and after. The first
attempt failed all three tests: it could not retrieve, could not schedule
and reported memory off. The second, after fixes, passed. That failure
sequence is left in the record because it is the evidence the fixes were
real rather than reported.

## Still outstanding, unchanged

- Stripe secrets absent, so billing cannot activate. Owner action.
- `yourway.ai` points at an unrelated external IP. The live product is
  `aiyourway.io`.
