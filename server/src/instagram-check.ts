/**
 * Verifies the Instagram token before you trust the live site to it.
 *
 *   npm run instagram:check
 *
 * Reads INSTAGRAM_ACCESS_TOKEN from server/.env, calls the Graph API exactly as
 * the site does, and reports what came back — how many posts, how recent, and
 * when the token itself expires. Prints nothing that could leak the token.
 */
import { env } from './env.js';

interface MediaItem {
  id: string;
  caption?: string;
  media_type: string;
  permalink: string;
  timestamp: string;
}

const fail = (message: string): never => {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
};

if (!env.instagramToken) {
  fail(
    'INSTAGRAM_ACCESS_TOKEN is not set.\n\n' +
      '    Add it to server/.env:\n' +
      '      INSTAGRAM_ACCESS_TOKEN=IGQ...\n\n' +
      '    See the README (“Imagery”) for how to issue one.',
  );
}

console.log('\n  Checking the Instagram token…\n');

// 1. The feed itself — the same call the public site makes.
const fields = 'id,caption,media_type,permalink,timestamp';
const feedUrl = `https://graph.instagram.com/me/media?fields=${fields}&limit=18&access_token=${encodeURIComponent(env.instagramToken)}`;

let posts: MediaItem[] = [];
try {
  const response = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
  const payload = (await response.json()) as { data?: MediaItem[]; error?: { message: string; type: string } };

  if (!response.ok || payload.error) {
    fail(
      `Instagram rejected the token (HTTP ${response.status}).\n` +
        `    ${payload.error?.message ?? 'No detail returned.'}\n\n` +
        '    Common causes: the token expired, it was issued for the wrong\n' +
        '    account, or the app is missing the instagram_graph_user_media\n' +
        '    permission.',
    );
  }

  posts = payload.data ?? [];
} catch (error) {
  fail(`Could not reach the Instagram Graph API: ${error instanceof Error ? error.message : String(error)}`);
}

if (posts.length === 0) {
  console.log('  ⚠ The token works, but the account returned no media.');
  console.log('    The site will fall back to the curated wall.\n');
  process.exit(0);
}

const newest = posts[0];
const age = Math.round((Date.now() - new Date(newest.timestamp).getTime()) / 86_400_000);

console.log(`  ✓ Token valid — ${posts.length} post${posts.length === 1 ? '' : 's'} returned.`);
console.log(`    Most recent: ${newest.media_type.toLowerCase()}, ${age} day${age === 1 ? '' : 's'} old`);
if (newest.caption) console.log(`    “${newest.caption.split('\n')[0].slice(0, 60)}…”`);

// 2. How long the token has left. A long-lived token runs 60 days and should be
//    refreshed before it lapses, or the feed quietly falls back one morning.
try {
  const response = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(env.instagramToken)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  const payload = (await response.json()) as { expires_in?: number };
  if (response.ok && payload.expires_in) {
    const days = Math.floor(payload.expires_in / 86_400);
    console.log(`\n  Token refreshed — valid for a further ${days} days.`);
    if (days < 14) console.log('  ⚠ Expiring soon. Re-run this check to refresh it.');
  }
} catch {
  // The feed call is the one that matters; a refresh hiccup is not fatal.
}

console.log('\n  The home page feed strip will show these posts.\n');
