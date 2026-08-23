import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/**
 * `Number('')` is 0, so a variable present but blank in .env would silently
 * become zero — a zero cache TTL or a zero rate limit rather than the default.
 * Anything not parsing to a finite number falls back.
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.warn(`[env] ${name}="${raw}" is not a number — using ${fallback}.`);
    return fallback;
  }
  return value;
}

/**
 * In production a real secret must be supplied — an ephemeral one would mean
 * every restart silently signs out every client, and a shared default would be
 * a forgeable session cookie.
 */
function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters in production');
  }
  const generated = randomBytes(32).toString('hex');
  console.warn('[env] SESSION_SECRET not set — generated a temporary one for this process only.');
  return generated;
}

export const env = {
  isProduction,
  isTest,
  port: num('PORT', 4000),
  databaseFile: required('DATABASE_FILE', 'data/portal.db'),
  sessionSecret: sessionSecret(),
  sessionTtlHours: num('SESSION_TTL_HOURS', 12),
  appUrl: required('APP_URL', 'http://localhost:5173'),
  /**
   * With no SMTP transport wired up, verification codes are written to the
   * server log. Outside production the code is also returned by the API so the
   * portal can be demonstrated end to end without a mailbox. Never in production.
   */
  revealCodes: !isProduction && process.env.REVEAL_CODES !== 'false',
  codeTtlMinutes: num('CODE_TTL_MINUTES', 15),
  maxCodeAttempts: num('MAX_CODE_ATTEMPTS', 5),
  /** Per-IP caps over a 15 minute window. Raised by the test suite, which is all one IP. */
  codeRequestLimit: num('CODE_REQUEST_LIMIT', 6),
  loginAttemptLimit: num('LOGIN_ATTEMPT_LIMIT', 10),
  /**
   * Instagram Graph API token for the public site's live feed. Optional — the
   * site falls back to its curated gallery when unset, so nothing breaks in
   * development or before the token is issued.
   */
  instagramToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
  instagramCacheMinutes: num('INSTAGRAM_CACHE_MINUTES', 10),
  /**
   * A failed feed fetch is cached for a shorter window than a good one, so an
   * expired token cannot turn every page view into its own upstream call.
   */
  instagramErrorCacheMinutes: num('INSTAGRAM_ERROR_CACHE_MINUTES', 2),
};
