import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  clearSession,
  consumeVerificationCode,
  createVerificationCode,
  hashPassword,
  issueRegistrationToken,
  issueSession,
  readRegistrationToken,
  requireAuth,
  toSessionUser,
  verifyPassword,
  type UserRow,
} from '../auth.js';
import { getDb, newId, nowIso, recordAudit } from '../db.js';
import { env } from '../env.js';
import { deliver, verificationEmail } from '../mailer.js';
import {
  decideLink,
  emailDomain,
  findClientMatches,
  isConsumerDomain,
  normaliseEmail,
  summariseHistory,
} from '../matching.js';

export const authRouter = Router();

const codeRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.codeRequestLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many codes requested. Please try again shortly.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.loginAttemptLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again shortly.' },
});

const emailField = z.string().trim().toLowerCase().email().max(254);
const passwordField = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'That password is too long.');

// ---------------------------------------------------------------------------
// Registration, step 1 of 3: prove the address belongs to you.
//
// Deliberately says nothing about whether the address is known to Genesis. A
// uniform response means the portal cannot be used to test who the agency's
// clients are.
// ---------------------------------------------------------------------------

const startSchema = z.object({
  email: emailField,
  fullName: z.string().trim().min(2).max(120),
});

authRouter.post('/register/start', codeRequestLimiter, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Please check your name and email address.' });
    return;
  }

  const db = getDb();
  const { email } = parsed.data;
  const existingUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: string } | undefined;

  let devCode: string | undefined;

  // An address that already has a portal login gets a nudge to sign in instead
  // of a code — but the caller cannot tell the two branches apart.
  if (!existingUser) {
    const code = createVerificationCode(db, email, 'register');
    await deliver(verificationEmail(email, code));
    if (env.revealCodes) devCode = code;
  }

  recordAudit(db, {
    actorEmail: email,
    action: 'register.start',
    ip: req.ip,
    detail: existingUser ? 'address already registered' : 'code sent',
  });

  res.json({
    ok: true,
    message: 'If that address can be used, a six-digit code is on its way.',
    ...(devCode ? { devCode } : {}),
  });
});

// ---------------------------------------------------------------------------
// Registration, step 2 of 3: check the code, then reveal what we hold.
//
// This is where the "existing customer" question is answered. Only now that
// ownership of the address is proven do we say whether there is history behind
// it, and how much.
// ---------------------------------------------------------------------------

const verifySchema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the six-digit code.'),
});

authRouter.post('/register/verify', codeRequestLimiter, (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter the six-digit code from your email.' });
    return;
  }

  const db = getDb();
  const { email, code } = parsed.data;
  const check = consumeVerificationCode(db, email, 'register', code);

  if (!check.ok) {
    const messages: Record<string, string> = {
      not_found: 'That code has expired or was already used. Request a new one.',
      expired: 'That code has expired. Request a new one.',
      too_many_attempts: 'Too many incorrect attempts. Request a new code.',
      mismatch: 'That code is not right. Check your email and try again.',
    };
    res.status(400).json({ error: messages[check.reason] });
    return;
  }

  const matches = findClientMatches(db, email);
  const outcome = decideLink(matches);
  const registrationToken = issueRegistrationToken(email);

  recordAudit(db, {
    actorEmail: email,
    action: 'register.verified',
    ip: req.ip,
    detail: `match=${outcome.kind}`,
  });

  if (outcome.kind === 'new_customer') {
    res.json({
      registrationToken,
      match: { kind: 'new_customer' },
      suggestedCompanyName: suggestCompanyName(email),
    });
    return;
  }

  const summary = summariseHistory(db, outcome.match.clientId);

  res.json({
    registrationToken,
    match: {
      kind: outcome.kind,
      companyName: outcome.match.companyName,
      confidence: outcome.match.confidence,
      reason: outcome.match.reason,
      history: summary,
    },
  });
});

/** A gentle default for the company field, e.g. northbank-studios.com -> Northbank Studios. */
function suggestCompanyName(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain || isConsumerDomain(domain)) return null;
  const label = domain.split('.')[0] ?? '';
  if (!label) return null;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Registration, step 3 of 3: create the account and attach the history.
// ---------------------------------------------------------------------------

const completeSchema = z.object({
  registrationToken: z.string().min(10),
  fullName: z.string().trim().min(2).max(120),
  password: passwordField,
  companyName: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

authRouter.post('/register/complete', async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Please check the details you entered.' });
    return;
  }

  const db = getDb();
  const { registrationToken, fullName, password, companyName, phone } = parsed.data;

  const email = readRegistrationToken(registrationToken);
  if (!email) {
    res.status(400).json({ error: 'That registration has expired. Please start again.' });
    return;
  }

  if (db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)) {
    res.status(409).json({ error: 'An account already exists for that address. Please sign in.' });
    return;
  }

  // The match is recomputed here rather than trusted from step 2, so a tampered
  // client payload cannot choose which company to attach to.
  const outcome = decideLink(findClientMatches(db, email));
  const passwordHash = await hashPassword(password);
  const userId = newId();
  const now = nowIso();

  const createEverything = db.transaction(() => {
    let clientId: string | null = null;
    let linkStatus: 'linked' | 'pending_review' | 'unlinked' = 'unlinked';

    if (outcome.kind === 'linked') {
      clientId = outcome.match.clientId;
      linkStatus = 'linked';
    } else if (outcome.kind === 'pending_review') {
      clientId = outcome.match.clientId;
      linkStatus = 'pending_review';
    } else {
      // Brand new customer: open a client record so their first enquiry, and
      // everything after it, has somewhere to live.
      clientId = newId();
      const domain = emailDomain(email);
      db.prepare(
        `INSERT INTO clients (id, company_name, client_type, status, primary_contact_name,
                              primary_contact_email, phone, email_domain, created_at, notes)
         VALUES (?, ?, 'brand', 'prospect', ?, ?, ?, ?, ?, ?)`,
      ).run(
        clientId,
        companyName?.trim() || `${fullName} (new enquiry)`,
        fullName,
        email,
        phone ?? null,
        domain && !isConsumerDomain(domain) ? domain : null,
        now,
        'Self-registered through the client portal.',
      );
      linkStatus = 'linked';
    }

    db.prepare(
      `INSERT INTO users (id, email, full_name, password_hash, client_id, link_status, role,
                          email_verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'client', ?, ?)`,
    ).run(userId, email, fullName, passwordHash, clientId, linkStatus, now, now);

    // Register the address against the client so the next colleague to sign up
    // is recognised, and so this login keeps working if the match rules change.
    if (clientId && linkStatus === 'linked') {
      const alreadyKnown = db
        .prepare(`SELECT id FROM client_contacts WHERE client_id = ? AND email = ?`)
        .get(clientId, email);
      if (!alreadyKnown) {
        db.prepare(
          `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
           VALUES (?, ?, ?, ?, 'Portal user', 0, 1, ?)`,
        ).run(newId(), clientId, fullName, email, now);
      }
    }

    if (outcome.kind === 'pending_review' && clientId) {
      db.prepare(
        `INSERT INTO link_requests (id, user_id, client_id, match_reason, confidence, status, requested_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(newId(), userId, clientId, outcome.match.reason, outcome.match.confidence, now);
    }

    recordAudit(db, {
      actorUserId: userId,
      actorEmail: email,
      action: 'register.complete',
      subjectType: 'client',
      subjectId: clientId,
      detail: `outcome=${outcome.kind}`,
      ip: req.ip,
    });
  });

  createEverything();

  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as UserRow;
  issueSession(res, row);

  res.status(201).json({
    user: toSessionUser(row),
    outcome: outcome.kind,
    ...(outcome.kind !== 'new_customer' ? { companyName: outcome.match.companyName } : {}),
  });
});

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(200) });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your email address and password.' });
    return;
  }

  const db = getDb();
  const { email, password } = parsed.data;
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as UserRow | undefined;

  // Always run a comparison so a missing account and a wrong password take a
  // similar amount of time.
  const hash = row?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await verifyPassword(password, hash);

  if (!row || !ok) {
    recordAudit(db, { actorEmail: email, action: 'login.failed', ip: req.ip });
    res.status(401).json({ error: 'That email address and password do not match.' });
    return;
  }

  db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).run(nowIso(), row.id);
  issueSession(res, row);
  recordAudit(db, { actorUserId: row.id, actorEmail: email, action: 'login.success', ip: req.ip });

  res.json({ user: toSessionUser({ ...row, last_login_at: nowIso() }) });
});

authRouter.post('/logout', (req, res) => {
  if (req.user) {
    recordAudit(getDb(), { actorUserId: req.user.id, actorEmail: req.user.email, action: 'logout', ip: req.ip });
  }
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = req.user!;
  const client = user.clientId
    ? (db.prepare(`SELECT id, company_name, status, account_manager FROM clients WHERE id = ?`).get(user.clientId) as
        | { id: string; company_name: string; status: string; account_manager: string | null }
        | undefined)
    : undefined;

  res.json({
    user,
    client: client
      ? {
          id: client.id,
          companyName: client.company_name,
          status: client.status,
          accountManager: client.account_manager,
        }
      : null,
  });
});
