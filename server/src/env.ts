import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
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
  port: Number(process.env.PORT ?? 4000),
  databaseFile: required('DATABASE_FILE', 'data/portal.db'),
  sessionSecret: sessionSecret(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  appUrl: required('APP_URL', 'http://localhost:5173'),
  /**
   * With no SMTP transport wired up, verification codes are written to the
   * server log. Outside production the code is also returned by the API so the
   * portal can be demonstrated end to end without a mailbox. Never in production.
   */
  revealCodes: !isProduction && process.env.REVEAL_CODES !== 'false',
  codeTtlMinutes: Number(process.env.CODE_TTL_MINUTES ?? 15),
  maxCodeAttempts: Number(process.env.MAX_CODE_ATTEMPTS ?? 5),
  /** Per-IP caps over a 15 minute window. Raised by the test suite, which is all one IP. */
  codeRequestLimit: Number(process.env.CODE_REQUEST_LIMIT ?? 6),
  loginAttemptLimit: Number(process.env.LOGIN_ATTEMPT_LIMIT ?? 10),
};
