import bcrypt from 'bcryptjs';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { getDb, newId, nowIso, type Db } from './db.js';

const BCRYPT_ROUNDS = 12;
export const SESSION_COOKIE = 'genesis_portal_session';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'agency_admin';
  clientId: string | null;
  linkStatus: 'linked' | 'pending_review' | 'unlinked';
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
  client_id: string | null;
  link_status: SessionUser['linkStatus'];
  role: SessionUser['role'];
  email_verified_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    clientId: row.client_id,
    linkStatus: row.link_status,
  };
}

// --- session cookie ---------------------------------------------------------

export function issueSession(res: Response, user: UserRow): void {
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.sessionSecret, {
    expiresIn: `${env.sessionTtlHours}h`,
  });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Reads the session cookie if present. Never rejects — see requireAuth. */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.sessionSecret) as { sub: string };
    const row = getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(payload.sub) as UserRow | undefined;
    if (row) req.user = toSessionUser(row);
  } catch {
    // An expired or tampered cookie is simply treated as signed out.
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  next();
}

export function requireAgencyAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'agency_admin') {
    res.status(403).json({ error: 'Agency access only.' });
    return;
  }
  next();
}

/**
 * The single gate every portal data route goes through.
 *
 * It returns the client id from the *session*, never from the request, so there
 * is no parameter a signed-in user could change to read another company's
 * records. An account whose link is still awaiting approval gets 403 rather
 * than an empty list, so the UI can explain why.
 */
export function resolveClientScope(req: Request, res: Response): string | null {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return null;
  }
  if (user.linkStatus === 'pending_review') {
    res.status(403).json({
      error: 'Your account is waiting to be approved by the Genesis team.',
      code: 'link_pending',
    });
    return null;
  }
  if (!user.clientId || user.linkStatus !== 'linked') {
    res.status(403).json({
      error: 'No client account is linked to this login yet.',
      code: 'not_linked',
    });
    return null;
  }
  return user.clientId;
}

// --- emailed verification codes --------------------------------------------

const hashCode = (code: string): string => createHash('sha256').update(code).digest('hex');

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function createVerificationCode(db: Db, email: string, purpose: 'register' | 'reset'): string {
  // Only one live code per address and purpose.
  db.prepare(`DELETE FROM verification_codes WHERE email = ? AND purpose = ? AND consumed_at IS NULL`).run(
    email,
    purpose,
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + env.codeTtlMinutes * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO verification_codes (id, email, code_hash, purpose, attempts, expires_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(newId(), email, hashCode(code), purpose, expiresAt, nowIso());

  return code;
}

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'too_many_attempts' | 'mismatch' };

export function consumeVerificationCode(
  db: Db,
  email: string,
  purpose: 'register' | 'reset',
  submitted: string,
): CodeCheck {
  const row = db
    .prepare(
      `SELECT * FROM verification_codes
        WHERE email = ? AND purpose = ? AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email, purpose) as
    | { id: string; code_hash: string; attempts: number; expires_at: string }
    | undefined;

  if (!row) return { ok: false, reason: 'not_found' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (row.attempts >= env.maxCodeAttempts) return { ok: false, reason: 'too_many_attempts' };

  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashCode(submitted.trim()), 'hex');
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    db.prepare(`UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    return { ok: false, reason: 'mismatch' };
  }

  db.prepare(`UPDATE verification_codes SET consumed_at = ? WHERE id = ?`).run(nowIso(), row.id);
  return { ok: true };
}

/**
 * Short-lived proof that the address in a registration was verified in this
 * session, so the final step cannot be called with someone else's address.
 */
export function issueRegistrationToken(email: string): string {
  return jwt.sign({ email, scope: 'registration' }, env.sessionSecret, { expiresIn: '20m' });
}

export function readRegistrationToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.sessionSecret) as { email?: string; scope?: string };
    if (payload.scope !== 'registration' || !payload.email) return null;
    return payload.email;
  } catch {
    return null;
  }
}
