import { env } from './env.js';

/**
 * Outbound mail.
 *
 * No SMTP transport is wired up yet — the portal is deliberately not coupled to
 * a provider. Messages are logged, and `deliver` returns the body so that the
 * dev-only code reveal in the auth routes has something to show. Swapping in
 * Resend/Postmark/SES means replacing the body of `deliver` only.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Test hook: what deliver() has handled, most recent last, so a suite can assert
 * an email was raised — and read a code out of one — without a transport and
 * without any endpoint returning the code in its response. Capped so a long-
 * running dev server does not grow it without bound, and never filled in
 * production.
 */
export const outbox: OutboundEmail[] = [];
const OUTBOX_LIMIT = 50;

export async function deliver(message: OutboundEmail): Promise<void> {
  if (env.isProduction) {
    // eslint-disable-next-line no-console
    console.info(`[mail] queued to=${message.to} subject="${message.subject}" (no transport configured)`);
    return;
  }

  outbox.push(message);
  if (outbox.length > OUTBOX_LIMIT) outbox.shift();

  // eslint-disable-next-line no-console
  console.info(
    ['', '─── outbound email ───', `to:      ${message.to}`, `subject: ${message.subject}`, '', message.body, '──────────────────────', ''].join(
      '\n',
    ),
  );
}

export function verificationEmail(to: string, code: string): OutboundEmail {
  return {
    to,
    subject: 'Your Genesis client portal code',
    body: [
      'Your verification code is:',
      '',
      `    ${code}`,
      '',
      `It expires in ${env.codeTtlMinutes} minutes.`,
      '',
      'If you did not request this, you can ignore this email — no account has been created.',
      '',
      'Genesis Model Management',
    ].join('\n'),
  };
}

export function passwordResetEmail(to: string, code: string): OutboundEmail {
  return {
    to,
    subject: 'Reset your Genesis client portal password',
    body: [
      'Use this code to choose a new password:',
      '',
      `    ${code}`,
      '',
      `It expires in ${env.codeTtlMinutes} minutes and can only be used once.`,
      '',
      'If you did not ask to reset your password you can ignore this email — your',
      'current password still works and nothing has changed.',
      '',
      'Genesis Model Management',
    ].join('\n'),
  };
}

export function linkApprovedEmail(to: string, companyName: string): OutboundEmail {
  return {
    to,
    subject: `Your portal access to ${companyName} is live`,
    body: [
      `Your Genesis client portal account has been approved and linked to ${companyName}.`,
      '',
      `Your bookings, correspondence and invoices are waiting for you at ${env.appUrl}/portal.`,
      '',
      'Genesis Model Management',
    ].join('\n'),
  };
}
