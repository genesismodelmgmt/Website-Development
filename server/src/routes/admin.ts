import { Router } from 'express';
import { z } from 'zod';
import { requireAgencyAdmin, requireAuth } from '../auth.js';
import { getDb, newId, nowIso, recordAudit } from '../db.js';
import { deliver, linkApprovedEmail } from '../mailer.js';

/**
 * The agency side of the link flow.
 *
 * When somebody registers on a company-domain match alone, their account exists
 * but shows nothing until a human at Genesis confirms they really are who they
 * say they are. This is that queue.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireAgencyAdmin);

adminRouter.get('/link-requests', (req, res) => {
  const status = z.enum(['pending', 'approved', 'rejected', 'all']).catch('pending').parse(req.query.status);

  const where = status === 'all' ? '' : 'WHERE lr.status = ?';
  const params = status === 'all' ? [] : [status];

  const rows = getDb()
    .prepare(
      `SELECT lr.id, lr.status, lr.confidence, lr.match_reason, lr.requested_at, lr.decided_at,
              u.id AS user_id, u.full_name, u.email,
              c.id AS client_id, c.company_name,
              (SELECT COUNT(*) FROM bookings b WHERE b.client_id = c.id) AS booking_count,
              -- Client-visible messages only: this figure is what approving the
              -- request would actually disclose, so internal notes are excluded.
              (SELECT COUNT(*) FROM communications m
                WHERE m.client_id = c.id AND m.visible_to_client = 1)   AS comms_count
         FROM link_requests lr
         JOIN users u   ON u.id = lr.user_id
         JOIN clients c ON c.id = lr.client_id
         ${where}
         ORDER BY lr.requested_at DESC`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  res.json({
    requests: rows.map((row) => ({
      id: row.id,
      status: row.status,
      confidence: row.confidence,
      reason: row.match_reason,
      requestedAt: row.requested_at,
      decidedAt: row.decided_at,
      user: { id: row.user_id, fullName: row.full_name, email: row.email },
      client: {
        id: row.client_id,
        companyName: row.company_name,
        bookingCount: row.booking_count,
        communicationCount: row.comms_count,
      },
    })),
  });
});

// ---------------------------------------------------------------------------
// Enquiries from the public site.
//
// The database is the system of record for these, not the notification email:
// `deliver` has no transport wired up, so until one is configured an enquiry
// that only ever became an email would be lost. This queue is what guarantees
// the "we reply to every enquiry" promise on the public site can be kept.
// ---------------------------------------------------------------------------

adminRouter.get('/enquiries', (req, res) => {
  const status = z.enum(['new', 'replied', 'closed', 'all']).catch('new').parse(req.query.status);

  const where = status === 'all' ? '' : 'WHERE status = ?';
  const params = status === 'all' ? [] : [status];

  const rows = getDb()
    .prepare(
      `SELECT id, kind, full_name, email, company, message, status, created_at
         FROM enquiries ${where}
        ORDER BY created_at DESC
        LIMIT 200`,
    )
    .all(...params) as Array<Record<string, unknown>>;

  const counts = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END), 0)     AS new_count,
         COALESCE(SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END), 0) AS replied_count,
         COUNT(*)                                                        AS total
       FROM enquiries`,
    )
    .get() as { new_count: number; replied_count: number; total: number };

  res.json({
    enquiries: rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      fullName: row.full_name,
      email: row.email,
      company: row.company,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    })),
    counts: { new: counts.new_count, replied: counts.replied_count, total: counts.total },
  });
});

const enquiryStatusSchema = z.object({ status: z.enum(['new', 'replied', 'closed']) });

adminRouter.post('/enquiries/:id', (req, res) => {
  const parsed = enquiryStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Status must be new, replied or closed.' });
    return;
  }

  const db = getDb();
  const admin = req.user!;
  const result = db.prepare(`UPDATE enquiries SET status = ? WHERE id = ?`).run(parsed.data.status, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Enquiry not found.' });
    return;
  }

  recordAudit(db, {
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'enquiry.status_changed',
    subjectType: 'enquiry',
    subjectId: req.params.id,
    detail: parsed.data.status,
    ip: req.ip,
  });

  res.json({ ok: true, status: parsed.data.status });
});

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});

adminRouter.post('/link-requests/:id', async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Decision must be approve or reject.' });
    return;
  }

  const db = getDb();
  const admin = req.user!;
  const request = db.prepare(`SELECT * FROM link_requests WHERE id = ?`).get(req.params.id) as
    | { id: string; user_id: string; client_id: string; status: string }
    | undefined;

  if (!request) {
    res.status(404).json({ error: 'Link request not found.' });
    return;
  }
  if (request.status !== 'pending') {
    res.status(409).json({ error: 'That request has already been decided.' });
    return;
  }

  const approved = parsed.data.decision === 'approve';
  const now = nowIso();

  const apply = db.transaction(() => {
    db.prepare(
      `UPDATE link_requests SET status = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?`,
    ).run(approved ? 'approved' : 'rejected', now, admin.email, parsed.data.note ?? null, request.id);

    if (approved) {
      db.prepare(`UPDATE users SET link_status = 'linked', client_id = ? WHERE id = ?`).run(
        request.client_id,
        request.user_id,
      );

      const user = db.prepare(`SELECT full_name, email FROM users WHERE id = ?`).get(request.user_id) as {
        full_name: string;
        email: string;
      };
      const known = db
        .prepare(`SELECT id FROM client_contacts WHERE client_id = ? AND email = ?`)
        .get(request.client_id, user.email);
      if (!known) {
        db.prepare(
          `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
           VALUES (?, ?, ?, ?, 'Portal user', 0, 1, ?)`,
        ).run(newId(), request.client_id, user.full_name, user.email, now);
      }
    } else {
      // Rejected claims keep the login but lose the company association.
      db.prepare(`UPDATE users SET link_status = 'unlinked', client_id = NULL WHERE id = ?`).run(request.user_id);
    }

    recordAudit(db, {
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: approved ? 'link_request.approved' : 'link_request.rejected',
      subjectType: 'link_request',
      subjectId: request.id,
      detail: parsed.data.note ?? null,
      ip: req.ip,
    });
  });

  apply();

  if (approved) {
    const details = db
      .prepare(
        `SELECT u.email AS email, c.company_name AS company
           FROM users u JOIN clients c ON c.id = u.client_id WHERE u.id = ?`,
      )
      .get(request.user_id) as { email: string; company: string } | undefined;
    if (details) await deliver(linkApprovedEmail(details.email, details.company));
  }

  res.json({ ok: true, status: approved ? 'approved' : 'rejected' });
});
