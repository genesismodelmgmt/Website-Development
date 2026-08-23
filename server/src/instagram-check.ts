/**
 * Verifies the Instagram token before you trust the live site to it.
 *
 *   npm run instagram:check -w server
 *
 * Calls the Graph API through the same code path the site uses, so a pass here
 * means the feed strip will render — not merely that the token authenticates.
 * Prints nothing that could leak the token itself.
 */
import { env } from './env.js';
import { requestInstagramMedia } from './routes/public.js';

const fail = (message: string): never => {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
};

if (!env.instagramToken) {
  fail(
    'INSTAGRAM_ACCESS_TOKEN is not set.\n\n' +
      '    Add it to server/.env:\n' +
      '      INSTAGRAM_ACCESS_TOKEN=IGA...\n\n' +
      '    See the README (“Imagery”) for how to issue one.',
  );
}

console.log('\n  Checking the Instagram token…\n');

// 1. The feed — the same request, and the same fields, that the site makes. A
//    token can authenticate happily and still return nothing the site can use,
//    so this checks for a usable picture rather than a 200.
let media: Awaited<ReturnType<typeof requestInstagramMedia>> = [];
try {
  media = await requestInstagramMedia(env.instagramToken);
} catch (error) {
  fail(
    `Instagram rejected the request.\n    ${error instanceof Error ? error.message : String(error)}\n\n` +
      '    Common causes: the token has expired, it belongs to a different\n' +
      '    account, or the app is missing the instagram_business_basic scope.',
  );
}

const usable = media.filter((item) => item.media_url || item.thumbnail_url);

if (media.length === 0) {
  console.log('  ⚠ The token works, but the account returned no media.');
  console.log('    The site will fall back to the curated wall.\n');
  process.exit(0);
}

if (usable.length === 0) {
  fail(
    `The token works and returned ${media.length} item(s), but none carry an\n` +
      '    image URL, so the site would show nothing. Check that the app has the\n' +
      '    instagram_business_basic permission granted.',
  );
}

const newest = usable[0]!;
const days = Math.round((Date.now() - new Date(newest.timestamp).getTime()) / 86_400_000);

console.log(`  ✓ Token valid — ${usable.length} usable post${usable.length === 1 ? '' : 's'}.`);
console.log(`    Most recent: ${newest.media_type.toLowerCase()}, ${days} day${days === 1 ? '' : 's'} old`);
if (newest.caption) console.log(`    “${newest.caption.split('\n')[0].slice(0, 60)}”`);
if (usable.length < media.length) {
  console.log(`    (${media.length - usable.length} item(s) had no image URL and will be skipped.)`);
}

// 2. How long the token has left. Reported, never silently relied upon: this
//    script cannot write a refreshed token back into .env, so a token nearing
//    expiry is something a person has to act on.
try {
  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(env.instagramToken)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  const payload = (await response.json().catch(() => ({}))) as { expires_in?: number; error?: { message: string } };

  if (!response.ok || payload.error) {
    console.log(`\n  ⚠ Could not read the token's expiry: ${payload.error?.message ?? `HTTP ${response.status}`}`);
    console.log('    Short-lived tokens (1 hour) cannot be refreshed — exchange');
    console.log('    yours for a long-lived one before relying on it.');
  } else if (payload.expires_in) {
    const left = Math.floor(payload.expires_in / 86_400);
    console.log(`\n  This token has ${left} day${left === 1 ? '' : 's'} left.`);
    if (left < 14) {
      console.log('  ⚠ Expiring soon. Issue a fresh long-lived token and replace');
      console.log('    INSTAGRAM_ACCESS_TOKEN in server/.env — this script reports');
      console.log('    the expiry but cannot write a new token for you.');
    }
  }
} catch (error) {
  console.log(`\n  ⚠ Could not reach the token endpoint: ${error instanceof Error ? error.message : String(error)}`);
}

console.log('\n  The home page feed strip will show these posts.\n');
