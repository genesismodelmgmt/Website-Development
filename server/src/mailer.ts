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

export async function deliver(message: OutboundEmail): Promise<void> {
  if (env.isProduction) {
    // eslint-disable-next-line no-console
    console.info(`[mail] queued to=${message.to} subject="${message.subject}" (no transport configured)`);
    return;
  }
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
