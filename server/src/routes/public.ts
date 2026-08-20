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

let feedCache: { fetchedAt: number; posts: InstagramPost[] } | null = null;

async function fetchInstagramFeed(): Promise<InstagramPost[]> {
  const ttlMs = env.instagramCacheMinutes * 60 * 1000;
  if (feedCache && Date.now() - feedCache.fetchedAt < ttlMs) return feedCache.posts;

  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const url = `https://graph.instagram.com/me/media?fields=${fields}&limit=18&access_token=${encodeURIComponent(env.instagramToken)}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Instagram responded ${response.status}`);

  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      caption?: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
    }>;
  };

  const posts: InstagramPost[] = (payload.data ?? [])
    .filter((item) => item.media_url || item.thumbnail_url)
    .map((item) => ({
      id: item.id,
      caption: item.caption ?? null,
      mediaType: item.media_type,
      // Videos render their thumbnail; the permalink carries people to the reel.
      mediaUrl: (item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url) ?? item.media_url ?? '',
      thumbnailUrl: item.thumbnail_url ?? null,
      permalink: item.permalink,
      timestamp: item.timestamp,
    }));

  feedCache = { fetchedAt: Date.now(), posts };
  return posts;
}

publicRouter.get('/instagram', async (_req, res) => {
  if (!env.instagramToken) {
    res.json({ configured: false, posts: [] });
    return;
  }

  try {
    const posts = await fetchInstagramFeed();
    res.json({ configured: true, posts });
  } catch (error) {
    // A stale feed beats an empty page; an empty feed beats an error page.
    // eslint-disable-next-line no-console
    console.warn('[instagram]', error instanceof Error ? error.message : error);
    res.json({ configured: true, posts: feedCache?.posts ?? [] });
  }
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

  await deliver({
    to: 'bookings@genesismodelmgmt.co.uk',
    subject: `New ${kind} enquiry — ${fullName}${company ? `, ${company}` : ''}`,
    body: [`From: ${fullName} <${email}>`, company ? `Company: ${company}` : null, '', message]
      .filter((line): line is string => line !== null)
      .join('\n'),
  });

  res.status(201).json({ ok: true });
});
