import type { Db } from './db.js';

/**
 * Recognising a returning customer.
 *
 * When somebody registers for the portal we have to answer one question: is
 * this an address the agency already has history against? Getting it wrong in
 * either direction is costly — a booker who has worked with Genesis for six
 * years should not land in an empty portal, and nobody should ever be handed
 * another company's bookings, fees or correspondence.
 *
 * So matches are graded by how much they actually prove:
 *
 *   exact  - the address itself is on the client record. Ownership of the
 *            address has already been proven by the emailed code, so this is
 *            linked automatically.
 *   domain - only the company domain matches (a new colleague at a client we
 *            know). Plausible, but it proves employment at best, so the account
 *            is created and a link request is queued for the agency to approve.
 *
 * Free/consumer mailbox domains are never used for domain matching: half of
 * London would match on gmail.com.
 */

export type MatchConfidence = 'exact' | 'domain';

export interface ClientMatch {
  clientId: string;
  companyName: string;
  confidence: MatchConfidence;
  reason: string;
}

const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'live.co.uk',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.co.uk',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'fastmail.com',
  'hey.com',
]);

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const at = normaliseEmail(email).lastIndexOf('@');
  if (at === -1) return null;
  const domain = normaliseEmail(email).slice(at + 1);
  return domain.length > 0 ? domain : null;
}

export function isConsumerDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}

interface ClientRow {
  id: string;
  company_name: string;
}

/**
 * Find every client record this address could belong to, strongest first.
 * A client is only ever returned once, at its best confidence.
 */
export function findClientMatches(db: Db, rawEmail: string): ClientMatch[] {
  const email = normaliseEmail(rawEmail);
  const domain = emailDomain(email);
  const byClient = new Map<string, ClientMatch>();

  const add = (match: ClientMatch): void => {
    const existing = byClient.get(match.clientId);
    if (existing && (existing.confidence === 'exact' || match.confidence === 'domain')) return;
    byClient.set(match.clientId, match);
  };

  // 1. The address is a known contact on a client record.
  //
  // Only a contact still marked active counts. Changing roles inside a company
  // is not the same event as leaving it, and the schema distinguishes them: an
  // address that was deactivated when its owner left must not still auto-link a
  // stranger — or whoever now receives that mailbox on a catch-all — to years of
  // fees, invoices and correspondence with no human in the loop.
  const contactRows = db
    .prepare(
      `SELECT c.id AS id, c.company_name AS company_name, cc.full_name AS contact_name
         FROM client_contacts cc
         JOIN clients c ON c.id = cc.client_id
        WHERE cc.email = ?
          AND cc.active = 1
          AND c.status != 'archived'`,
    )
    .all(email) as Array<ClientRow & { contact_name: string | null }>;

  for (const row of contactRows) {
    add({
      clientId: row.id,
      companyName: row.company_name,
      confidence: 'exact',
      reason: `${email} is on file as a contact for ${row.company_name}`,
    });
  }

  // 2. The address is the primary contact on a client record.
  const primaryRows = db
    .prepare(
      `SELECT id, company_name
         FROM clients
        WHERE primary_contact_email = ?
          AND status != 'archived'`,
    )
    .all(email) as ClientRow[];

  for (const row of primaryRows) {
    add({
      clientId: row.id,
      companyName: row.company_name,
      confidence: 'exact',
      reason: `${email} is the main contact for ${row.company_name}`,
    });
  }

  // 3. Company domain only — a colleague of someone we already work with.
  if (domain && !isConsumerDomain(domain)) {
    const domainRows = db
      .prepare(
        `SELECT id, company_name
           FROM clients
          WHERE email_domain = ?
            AND status != 'archived'`,
      )
      .all(domain) as ClientRow[];

    for (const row of domainRows) {
      add({
        clientId: row.id,
        companyName: row.company_name,
        confidence: 'domain',
        reason: `${domain} is the company domain on file for ${row.company_name}`,
      });
    }
  }

  return [...byClient.values()].sort((a, b) =>
    a.confidence === b.confidence ? a.companyName.localeCompare(b.companyName) : a.confidence === 'exact' ? -1 : 1,
  );
}

export type LinkOutcome =
  | { kind: 'linked'; match: ClientMatch }
  | { kind: 'pending_review'; match: ClientMatch }
  | { kind: 'new_customer' };

/**
 * Turn the candidate matches into a decision.
 *
 * A single exact match links straight away. Anything ambiguous (several
 * companies claiming the same address, or a domain-only hit) goes to the agency
 * rather than guessing, because guessing wrong discloses another client's data.
 */
export function decideLink(matches: ClientMatch[]): LinkOutcome {
  const exact = matches.filter((m) => m.confidence === 'exact');
  if (exact.length === 1) return { kind: 'linked', match: exact[0] };
  if (exact.length > 1) return { kind: 'pending_review', match: exact[0] };

  const domain = matches.filter((m) => m.confidence === 'domain');
  if (domain.length >= 1) return { kind: 'pending_review', match: domain[0] };

  return { kind: 'new_customer' };
}

export interface HistorySummary {
  bookings: number;
  communications: number;
  invoices: number;
  firstBookedOn: string | null;
  lastActivityOn: string | null;
}

/** What we can promise to pull through, shown before the account is created. */
export function summariseHistory(db: Db, clientId: string): HistorySummary {
  const bookings = db
    .prepare(`SELECT COUNT(*) AS n, MIN(start_date) AS first FROM bookings WHERE client_id = ?`)
    .get(clientId) as { n: number; first: string | null };

  const comms = db
    .prepare(
      `SELECT COUNT(*) AS n, MAX(occurred_at) AS last
         FROM communications
        WHERE client_id = ? AND visible_to_client = 1`,
    )
    .get(clientId) as { n: number; last: string | null };

  const invoices = db.prepare(`SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?`).get(clientId) as {
    n: number;
  };

  return {
    bookings: bookings.n,
    communications: comms.n,
    invoices: invoices.n,
    firstBookedOn: bookings.first,
    lastActivityOn: comms.last,
  };
}
