import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getDb, newId, nowIso, recordAudit } from '../db.js';
import { env } from '../env.js';
import { deliver } from '../mailer.js';

/**
 * Everything under /api/public serves the signed-out marketing site: the live
 * Instagram feed, newsletter signups and booking enquiries. Nothing here reads
 * a session, and nothing here can reach client data.
 */
export const publicRouter = Router();

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

/** Generous — this is a public page load — but not unbounded. */
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

// ---------------------------------------------------------------------------
// Instagram feed
//
// When INSTAGRAM_ACCESS_TOKEN is set (an Instagram Graph API token for the
// agency account), the latest posts are fetched and cached in memory. When it
// is not, the endpoint says so and the front end shows its curated gallery
// instead — the page never depends on Meta being up.
// ---------------------------------------------------------------------------

export interface InstagramPost {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
}

/** The fields the front end needs. Exported so the token check requests the same set. */
export const INSTAGRAM_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

/** Shapes one Graph API item, dropping anything with no usable picture. */
function toPost(item: InstagramMedia): InstagramPost | null {
  // Videos have a poster frame in thumbnail_url and no still in media_url;
  // images are the other way round. Either may stand in for the other, but an
  // item with neither has no picture to show and is dropped rather than
  // rendered as <img src="">, which re-requests the current page.
  const mediaUrl = (item.media_type === 'VIDEO' ? item.thumbnail_url ?? item.media_url : item.media_url ?? item.thumbnail_url) ?? '';
  if (!mediaUrl) return null;

  return {
    id: item.id,
    caption: item.caption ?? null,
    mediaType: item.media_type,
    mediaUrl,
    thumbnailUrl: item.thumbnail_url ?? null,
    permalink: item.permalink,
    timestamp: item.timestamp,
  };
}

export async function requestInstagramMedia(token: string, limit = 18): Promise<InstagramMedia[]> {
  const url = `https://graph.instagram.com/me/media?fields=${INSTAGRAM_FIELDS}&limit=${limit}&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const payload = (await response.json().catch(() => ({}))) as { data?: InstagramMedia[]; error?: { message: string } };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Instagram responded ${response.status}`);
  }
  return payload.data ?? [];
}

/**
 * `ok: false` marks a failed attempt. Failures are cached too — for a shorter
 * window — so an expired token cannot turn every page view into its own 8s
 * upstream call and burn the account's Graph quota.
 */
let feedCache: { fetchedAt: number; ok: boolean; posts: InstagramPost[] } | null = null;

/** One in-flight refresh at a time; concurrent callers await the same promise. */
let inFlight: Promise<InstagramPost[]> | null = null;

function cacheIsFresh(): boolean {
  if (!feedCache) return false;
  const minutes = feedCache.ok ? env.instagramCacheMinutes : env.instagramErrorCacheMinutes;
  return Date.now() - feedCache.fetchedAt < minutes * 60 * 1000;
}

async function fetchInstagramFeed(): Promise<InstagramPost[]> {
  if (cacheIsFresh()) return feedCache!.posts;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const posts = (await requestInstagramMedia(env.instagramToken))
        .map(toPost)
        .filter((post): post is InstagramPost => post !== null);
      feedCache = { fetchedAt: Date.now(), ok: true, posts };
      return posts;
    } catch (error) {
      // Keep serving the last good feed while the failure is remembered, so a
      // token that lapsed overnight does not blank the band immediately.
      // eslint-disable-next-line no-console
      console.warn('[instagram]', error instanceof Error ? error.message : error);
      const stale = feedCache?.ok ? feedCache.posts : [];
      feedCache = { fetchedAt: Date.now(), ok: false, posts: stale };
      return stale;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Test hook: the cache is process-wide, so a suite must be able to clear it. */
export function resetInstagramCache(): void {
  feedCache = null;
  inFlight = null;
}

publicRouter.get('/instagram', readLimiter, async (_req, res) => {
  if (!env.instagramToken) {
    res.json({ configured: false, posts: [] });
    return;
  }

  const posts = await fetchInstagramFeed();
  res.json({ configured: true, posts });
});

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(['home', 'journal', 'footer']).default('footer'),
});

publicRouter.post('/newsletter', writeLimiter, (req, res) => {
  const parsed = newsletterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const db = getDb();
  const { email, source } = parsed.data;

  // Re-subscribing is a no-op, and the response does not distinguish the two —
  // the form cannot be used to test who is already on the list.
  db.prepare(
    `INSERT INTO newsletter_subscribers (id, email, source, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
  ).run(newId(), email, source, nowIso());

  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

const enquirySchema = z.object({
  kind: z.enum(['booking', 'model', 'general']).default('booking'),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(4000),
});

publicRouter.post('/enquiries', writeLimiter, async (req, res) => {
  const parsed = enquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please complete your name, email and a short message.' });
    return;
  }

  const db = getDb();
  const { kind, fullName, email, company, message } = parsed.data;
  const id = newId();

  db.prepare(
    `INSERT INTO enquiries (id, kind, full_name, email, company, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`,
  ).run(id, kind, fullName, email, company ?? null, message, nowIso());

  recordAudit(db, {
    actorEmail: email,
    action: 'public.enquiry_received',
    subjectType: 'enquiry',
    subjectId: id,
    detail: kind,
    ip: req.ip,
  });

  // The row above is the system of record; this notification is a convenience.
  // Until a mail transport is configured `deliver` only logs, so the enquiry is
  // read from the agency queue (GET /api/admin/enquiries) rather than lost.
  await deliver({
    to: 'bookings@genesismodelmgmt.co.uk',
    subject: `New ${kind} enquiry — ${fullName}${company ? `, ${company}` : ''}`,
    body: [`From: ${fullName} <${email}>`, company ? `Company: ${company}` : null, '', message]
      .filter((line): line is string => line !== null)
      .join('\n'),
  });

  res.status(201).json({ ok: true });
});
