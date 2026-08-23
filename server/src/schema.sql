-- Genesis Model Management - client portal schema
--
-- Written in portable SQL so it can be lifted to Postgres/Supabase later.
-- Money is stored in integer pence to avoid float rounding on fees and invoices.
-- Timestamps are ISO-8601 strings in UTC.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Customers (the agency's client companies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id                    TEXT PRIMARY KEY,
  company_name          TEXT NOT NULL,
  client_type           TEXT NOT NULL DEFAULT 'brand',    -- brand | agency | casting | publication | other
  status                TEXT NOT NULL DEFAULT 'prospect', -- active | dormant | prospect | archived
  primary_contact_name  TEXT,
  primary_contact_email TEXT,
  phone                 TEXT,
  billing_address       TEXT,
  email_domain          TEXT,                             -- e.g. northbankstudios.com (drives domain matching)
  account_manager       TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_domain ON clients (email_domain);
CREATE INDEX IF NOT EXISTS idx_clients_primary_email ON clients (primary_contact_email);

-- Every email address the agency has ever dealt with for a client. This is the
-- table that makes "sign in as an existing customer" work: a returning booker
-- is recognised by an address we already hold, even if they are not the primary
-- contact and even if they have since changed roles.
CREATE TABLE IF NOT EXISTS client_contacts (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT NOT NULL,                    -- always stored lower-cased
  role        TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts (email);
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts (client_id);

-- ---------------------------------------------------------------------------
-- Portal accounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,             -- always stored lower-cased
  full_name         TEXT NOT NULL,
  password_hash     TEXT,
  client_id         TEXT REFERENCES clients (id) ON DELETE SET NULL,
  -- linked         : the account may read this client's history
  -- pending_review : matched on a weaker signal, waiting for agency approval
  -- unlinked       : brand new customer, no history to show yet
  link_status       TEXT NOT NULL DEFAULT 'unlinked',
  role              TEXT NOT NULL DEFAULT 'client',   -- client | agency_admin
  email_verified_at TEXT,
  created_at        TEXT NOT NULL,
  last_login_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_client ON users (client_id);

-- Short-lived codes emailed to prove ownership of an address. We never reveal
-- whether an address is known to the agency until the matching code comes back,
-- so the portal cannot be used to enumerate the client list.
CREATE TABLE IF NOT EXISTS verification_codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  purpose     TEXT NOT NULL,                    -- register | reset
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes (email, purpose);

-- A claim on an existing client record that needs a human at the agency to
-- approve it (raised when the match was by company domain rather than by an
-- address we already hold).
CREATE TABLE IF NOT EXISTS link_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id     TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  match_reason  TEXT NOT NULL,
  confidence    TEXT NOT NULL,                  -- exact | domain | manual
  status        TEXT NOT NULL DEFAULT 'pending',-- pending | approved | rejected
  requested_at  TEXT NOT NULL,
  decided_at    TEXT,
  decided_by    TEXT,
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests (status);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  reference        TEXT NOT NULL UNIQUE,        -- GEN-2025-014
  title            TEXT NOT NULL,
  job_type         TEXT NOT NULL,               -- campaign | editorial | ecommerce | show | fitting | casting
  status           TEXT NOT NULL,               -- enquiry | option | confirmed | completed | cancelled
  start_date       TEXT,
  end_date         TEXT,
  location         TEXT,
  usage_terms      TEXT,
  fee_pence        INTEGER NOT NULL DEFAULT 0,  -- model fee, before agency commission
  agency_fee_pence INTEGER NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'GBP',
  booker           TEXT,                        -- who at Genesis ran the job
  brief            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings (client_id, start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (client_id, status);

CREATE TABLE IF NOT EXISTS booking_models (
  id             TEXT PRIMARY KEY,
  booking_id     TEXT NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  model_name     TEXT NOT NULL,
  board          TEXT,                          -- women | men | new-faces
  role           TEXT,
  day_rate_pence INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'confirmed' -- optioned | confirmed | released
);

CREATE INDEX IF NOT EXISTS idx_booking_models_booking ON booking_models (booking_id);

-- ---------------------------------------------------------------------------
-- Communications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS communications (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  booking_id        TEXT REFERENCES bookings (id) ON DELETE SET NULL,
  channel           TEXT NOT NULL,              -- email | call | meeting | whatsapp | portal | note
  direction         TEXT NOT NULL,              -- inbound | outbound
  subject           TEXT,
  body              TEXT NOT NULL,
  from_name         TEXT,
  from_email        TEXT,
  to_email          TEXT,
  thread_key        TEXT,                       -- groups a back-and-forth into one conversation
  -- Internal notes stay internal: anything with visible_to_client = 0 is never
  -- returned by a portal query.
  visible_to_client INTEGER NOT NULL DEFAULT 1,
  occurred_at       TEXT NOT NULL,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comms_client ON communications (client_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_comms_booking ON communications (booking_id);
CREATE INDEX IF NOT EXISTS idx_comms_thread ON communications (thread_key);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  booking_id  TEXT REFERENCES bookings (id) ON DELETE SET NULL,
  number      TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL,                    -- draft | sent | paid | overdue | void
  issued_on   TEXT,
  due_on      TEXT,
  paid_on     TEXT,
  net_pence   INTEGER NOT NULL DEFAULT 0,
  vat_pence   INTEGER NOT NULL DEFAULT 0,
  total_pence INTEGER NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'GBP',
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices (client_id, status);

-- ---------------------------------------------------------------------------
-- Public site
-- ---------------------------------------------------------------------------

-- Journal readers who asked to be kept in touch. Deliberately minimal: an
-- address, where the signup came from, and when — nothing worth stealing.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,              -- always stored lower-cased
  source      TEXT,                              -- home | journal | footer
  created_at  TEXT NOT NULL
);

-- Enquiries from the public site. These are prospects, not clients — a booking
-- enquiry graduates into the clients table when the agency takes it on.
CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'booking',   -- booking | model | general
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new',       -- new | replied | closed
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries (status, created_at);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_email   TEXT,
  action        TEXT NOT NULL,
  subject_type  TEXT,
  subject_id    TEXT,
  detail        TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
