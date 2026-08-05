/**
 * Demo data for the client portal.
 *
 * Every company, model, person and figure below is invented for development and
 * demonstration. None of it represents a real client, booking, or payment, and
 * it must never be loaded over a production database — `npm run seed` refuses to
 * run when NODE_ENV=production.
 *
 * The seed is built to exercise the three registration outcomes:
 *
 *   freya.lambert@northbankstudios.com  known contact, no portal login yet
 *                                       -> exact match, links six years of history
 *   hugo.reyes@northbankstudios.com     existing portal login (password below)
 *                                       -> straight sign-in
 *   anyone@northbankstudios.com         unknown address on a known company domain
 *                                       -> account created, agency approval queued
 *   anyone@somewhereelse.com            no match -> new customer record
 */

import { existsSync, rmSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { openDatabase, newId, nowIso, resolveDatabasePath, type Db } from './db.js';
import { env } from './env.js';

const DEMO_PASSWORD = 'Portal-Demo-2026';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const databasePath = resolveDatabasePath(env.databaseFile);

if (process.argv.includes('--reset') && databasePath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) rmSync(path);
  }
  console.info(`Removed ${databasePath}`);
}

const db = openDatabase();
seed(db);

function seed(db: Db): void {
  const already = db.prepare(`SELECT COUNT(*) AS n FROM clients`).get() as { n: number };
  if (already.n > 0) {
    console.info('Database already has clients — run `npm run db:reset` to rebuild from scratch.');
    process.exit(0);
  }

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  const now = nowIso();

  const insertClient = db.prepare(
    `INSERT INTO clients (id, company_name, client_type, status, primary_contact_name, primary_contact_email,
                          phone, billing_address, email_domain, account_manager, notes, created_at)
     VALUES (@id, @company_name, @client_type, @status, @primary_contact_name, @primary_contact_email,
             @phone, @billing_address, @email_domain, @account_manager, @notes, @created_at)`,
  );
  const insertContact = db.prepare(
    `INSERT INTO client_contacts (id, client_id, full_name, email, role, is_primary, active, created_at)
     VALUES (@id, @client_id, @full_name, @email, @role, @is_primary, 1, @created_at)`,
  );
  const insertUser = db.prepare(
    `INSERT INTO users (id, email, full_name, password_hash, client_id, link_status, role, email_verified_at, created_at)
     VALUES (@id, @email, @full_name, @password_hash, @client_id, @link_status, @role, @created_at, @created_at)`,
  );
  const insertBooking = db.prepare(
    `INSERT INTO bookings (id, client_id, reference, title, job_type, status, start_date, end_date, location,
                           usage_terms, fee_pence, agency_fee_pence, currency, booker, brief, created_at, updated_at)
     VALUES (@id, @client_id, @reference, @title, @job_type, @status, @start_date, @end_date, @location,
             @usage_terms, @fee_pence, @agency_fee_pence, 'GBP', @booker, @brief, @created_at, @created_at)`,
  );
  const insertModel = db.prepare(
    `INSERT INTO booking_models (id, booking_id, model_name, board, role, day_rate_pence, status)
     VALUES (@id, @booking_id, @model_name, @board, @role, @day_rate_pence, @status)`,
  );
  const insertComm = db.prepare(
    `INSERT INTO communications (id, client_id, booking_id, channel, direction, subject, body, from_name,
                                 from_email, to_email, thread_key, visible_to_client, occurred_at, created_at)
     VALUES (@id, @client_id, @booking_id, @channel, @direction, @subject, @body, @from_name,
             @from_email, @to_email, @thread_key, @visible_to_client, @occurred_at, @occurred_at)`,
  );
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (id, client_id, booking_id, number, status, issued_on, due_on, paid_on,
                           net_pence, vat_pence, total_pence, currency, created_at)
     VALUES (@id, @client_id, @booking_id, @number, @status, @issued_on, @due_on, @paid_on,
             @net_pence, @vat_pence, @total_pence, 'GBP', @created_at)`,
  );

  const build = db.transaction(() => {
    // -- Genesis staff login --------------------------------------------------
    insertUser.run({
      id: newId(),
      email: 'ops@genesismodelmgmt.co.uk',
      full_name: 'Genesis Operations',
      password_hash: passwordHash,
      client_id: null,
      link_status: 'unlinked',
      role: 'agency_admin',
      created_at: now,
    });

    // -- Client one: long-standing, plenty of history -------------------------
    const northbank = newId();
    insertClient.run({
      id: northbank,
      company_name: 'Northbank Studios',
      client_type: 'brand',
      status: 'active',
      primary_contact_name: 'Freya Lambert',
      primary_contact_email: 'freya.lambert@northbankstudios.com',
      phone: '+44 20 7946 0112',
      billing_address: 'Unit 4, Bankside Yard, London SE1 9GF',
      email_domain: 'northbankstudios.com',
      account_manager: 'Grace Whitmore',
      notes: 'Demo record. Books twice a year for seasonal campaigns.',
      created_at: '2020-09-14T09:00:00.000Z',
    });

    for (const contact of [
      { name: 'Freya Lambert', email: 'freya.lambert@northbankstudios.com', role: 'Head of Brand', primary: 1 },
      { name: 'Hugo Reyes', email: 'hugo.reyes@northbankstudios.com', role: 'Producer', primary: 0 },
      { name: 'Ines Duarte', email: 'ines.duarte@northbankstudios.com', role: 'Production Assistant', primary: 0 },
    ]) {
      insertContact.run({
        id: newId(),
        client_id: northbank,
        full_name: contact.name,
        email: contact.email,
        role: contact.role,
        is_primary: contact.primary,
        created_at: '2020-09-14T09:00:00.000Z',
      });
    }

    // Hugo already has a portal login; Freya and Ines do not, so the "existing
    // customer" registration path can be demonstrated with their addresses.
    insertUser.run({
      id: newId(),
      email: 'hugo.reyes@northbankstudios.com',
      full_name: 'Hugo Reyes',
      password_hash: passwordHash,
      client_id: northbank,
      link_status: 'linked',
      role: 'client',
      created_at: '2025-02-03T10:12:00.000Z',
    });

    const nbBookings = [
      {
        reference: 'GEN-2023-0184',
        title: 'Autumn/Winter 23 Lookbook',
        job_type: 'ecommerce',
        status: 'completed',
        start_date: '2023-08-21',
        end_date: '2023-08-22',
        location: 'Bankside Yard, London',
        usage_terms: 'E-commerce and owned social, 12 months, UK.',
        fee_pence: 480_000,
        agency_fee_pence: 96_000,
        booker: 'Grace Whitmore',
        brief: 'Two-day studio shoot, 90 looks across womenswear.',
        models: [
          { name: 'Aiyana Brooks', board: 'women', role: 'Lead', rate: 180_000, status: 'confirmed' },
          { name: 'Marta Kellen', board: 'women', role: 'Supporting', rate: 150_000, status: 'confirmed' },
        ],
      },
      {
        reference: 'GEN-2024-0092',
        title: 'Spring Campaign — Print & OOH',
        job_type: 'campaign',
        status: 'completed',
        start_date: '2024-03-11',
        end_date: '2024-03-13',
        location: 'Dungeness, Kent',
        usage_terms: 'Print, OOH and digital, 18 months, UK and EU.',
        fee_pence: 1_450_000,
        agency_fee_pence: 290_000,
        booker: 'Grace Whitmore',
        brief: 'Three-day location shoot. Weather cover held for the 14th.',
        models: [
          { name: 'Aiyana Brooks', board: 'women', role: 'Lead', rate: 750_000, status: 'confirmed' },
          { name: 'Theo Vance', board: 'men', role: 'Lead', rate: 700_000, status: 'confirmed' },
        ],
      },
      {
        reference: 'GEN-2024-0311',
        title: 'Festive Gifting Stills',
        job_type: 'ecommerce',
        status: 'completed',
        start_date: '2024-10-02',
        end_date: '2024-10-02',
        location: 'Hoxton Studio 3, London',
        usage_terms: 'Owned channels, 12 months, worldwide.',
        fee_pence: 260_000,
        agency_fee_pence: 52_000,
        booker: 'Iliyan Petrov',
        brief: 'Single day, hands and product-adjacent stills.',
        models: [{ name: 'Marta Kellen', board: 'women', role: 'Lead', rate: 260_000, status: 'confirmed' }],
      },
      {
        reference: 'GEN-2025-0147',
        title: 'SS25 Editorial with Frame Quarterly',
        job_type: 'editorial',
        status: 'completed',
        start_date: '2025-04-08',
        end_date: '2025-04-09',
        location: 'Lisbon, Portugal',
        usage_terms: 'Editorial only, no commercial extension.',
        fee_pence: 320_000,
        agency_fee_pence: 64_000,
        booker: 'Grace Whitmore',
        brief: 'Travel and accommodation covered by production.',
        models: [{ name: 'Sena Whitfield', board: 'new-faces', role: 'Lead', rate: 320_000, status: 'confirmed' }],
      },
      {
        reference: 'GEN-2026-0203',
        title: 'AW26 Campaign — Film & Stills',
        job_type: 'campaign',
        status: 'confirmed',
        start_date: '2026-09-14',
        end_date: '2026-09-16',
        location: 'Studio 12, Park Royal, London',
        usage_terms: 'All media excluding TV, 24 months, worldwide.',
        fee_pence: 2_100_000,
        agency_fee_pence: 420_000,
        booker: 'Grace Whitmore',
        brief: 'Three days: two stills, one film. Wardrobe fitting on the 10th.',
        models: [
          { name: 'Aiyana Brooks', board: 'women', role: 'Lead', rate: 900_000, status: 'confirmed' },
          { name: 'Theo Vance', board: 'men', role: 'Lead', rate: 800_000, status: 'confirmed' },
          { name: 'Sena Whitfield', board: 'new-faces', role: 'Supporting', rate: 400_000, status: 'confirmed' },
        ],
      },
      {
        reference: 'GEN-2026-0244',
        title: 'AW26 Wardrobe Fitting',
        job_type: 'fitting',
        status: 'option',
        start_date: '2026-09-10',
        end_date: '2026-09-10',
        location: 'Studio 12, Park Royal, London',
        usage_terms: 'No usage — fitting only.',
        fee_pence: 90_000,
        agency_fee_pence: 18_000,
        booker: 'Iliyan Petrov',
        brief: 'Half day, three models, second option held until 22 August.',
        models: [
          { name: 'Aiyana Brooks', board: 'women', role: 'Fitting', rate: 30_000, status: 'optioned' },
          { name: 'Theo Vance', board: 'men', role: 'Fitting', rate: 30_000, status: 'optioned' },
          { name: 'Sena Whitfield', board: 'new-faces', role: 'Fitting', rate: 30_000, status: 'optioned' },
        ],
      },
    ];

    const nbIds = new Map<string, string>();
    for (const booking of nbBookings) {
      const id = newId();
      nbIds.set(booking.reference, id);
      insertBooking.run({
        id,
        client_id: northbank,
        reference: booking.reference,
        title: booking.title,
        job_type: booking.job_type,
        status: booking.status,
        start_date: booking.start_date,
        end_date: booking.end_date,
        location: booking.location,
        usage_terms: booking.usage_terms,
        fee_pence: booking.fee_pence,
        agency_fee_pence: booking.agency_fee_pence,
        booker: booking.booker,
        brief: booking.brief,
        created_at: `${booking.start_date}T09:00:00.000Z`,
      });
      for (const model of booking.models) {
        insertModel.run({
          id: newId(),
          booking_id: id,
          model_name: model.name,
          board: model.board,
          role: model.role,
          day_rate_pence: model.rate,
          status: model.status,
        });
      }
    }

    const nbComms: Array<{
      ref?: string;
      channel: string;
      direction: 'inbound' | 'outbound';
      subject: string;
      body: string;
      from: string;
      email: string;
      at: string;
      thread: string;
      internal?: boolean;
    }> = [
      {
        ref: 'GEN-2023-0184',
        channel: 'email',
        direction: 'inbound',
        subject: 'AW23 lookbook — availability?',
        body: 'Hi Grace, we are pencilling two days in late August for the AW23 lookbook. Could you send options for two women, commercial-leaning? Budget is around £5k all in.',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2023-07-28T09:14:00.000Z',
        thread: 'nb-aw23',
      },
      {
        ref: 'GEN-2023-0184',
        channel: 'email',
        direction: 'outbound',
        subject: 'Re: AW23 lookbook — availability?',
        body: 'Freya, lovely to hear from you. Package attached with six options, all free on the 21st and 22nd. Aiyana and Marta would be my pick for the tone you described.',
        from: 'Grace Whitmore',
        email: 'grace@genesismodelmgmt.co.uk',
        at: '2023-07-28T15:02:00.000Z',
        thread: 'nb-aw23',
      },
      {
        ref: 'GEN-2023-0184',
        channel: 'call',
        direction: 'inbound',
        subject: 'Call — confirming the two-day booking',
        body: 'Freya called to confirm Aiyana and Marta for both days. Call sheet to follow from their producer.',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2023-08-01T11:30:00.000Z',
        thread: 'nb-aw23',
      },
      {
        ref: 'GEN-2024-0092',
        channel: 'email',
        direction: 'inbound',
        subject: 'Spring campaign — bigger one this time',
        body: 'Grace — we have signed off a proper campaign for spring. Three days on location in Kent, print and OOH, 18 months UK/EU. Can we talk numbers this week?',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2024-01-22T08:47:00.000Z',
        thread: 'nb-ss24',
      },
      {
        ref: 'GEN-2024-0092',
        channel: 'meeting',
        direction: 'outbound',
        subject: 'Budget and usage meeting',
        body: 'Met at Bankside. Agreed £14,500 model fees plus 20% agency commission for the three days, 18 months UK/EU, with an option to extend to worldwide at 30%.',
        from: 'Miles Sterling',
        email: 'miles@genesismodelmgmt.co.uk',
        at: '2024-01-30T14:00:00.000Z',
        thread: 'nb-ss24',
      },
      {
        ref: 'GEN-2024-0092',
        channel: 'note',
        direction: 'outbound',
        subject: 'Internal — margin note',
        body: 'Internal only: we held commission at 20% to win the campaign. Review at renewal.',
        from: 'Miles Sterling',
        email: 'miles@genesismodelmgmt.co.uk',
        at: '2024-01-30T17:30:00.000Z',
        thread: 'nb-ss24',
        internal: true,
      },
      {
        ref: 'GEN-2024-0092',
        channel: 'email',
        direction: 'outbound',
        subject: 'Call sheets and weather cover',
        body: 'Call sheets circulated for the 11th to 13th. Weather cover is held on the 14th at no extra fee if we release by 6pm on the 13th.',
        from: 'Grace Whitmore',
        email: 'grace@genesismodelmgmt.co.uk',
        at: '2024-03-06T16:20:00.000Z',
        thread: 'nb-ss24',
      },
      {
        ref: 'GEN-2024-0311',
        channel: 'email',
        direction: 'inbound',
        subject: 'Quick one — festive stills',
        body: 'Do you have Marta for a single day in early October? Small one, owned channels only.',
        from: 'Hugo Reyes',
        email: 'hugo.reyes@northbankstudios.com',
        at: '2024-09-12T10:05:00.000Z',
        thread: 'nb-festive',
      },
      {
        ref: 'GEN-2024-0311',
        channel: 'email',
        direction: 'outbound',
        subject: 'Re: Quick one — festive stills',
        body: 'She is free on the 2nd. £2,600 plus commission for the day, owned channels, 12 months worldwide. Shall I hold it?',
        from: 'Iliyan Petrov',
        email: 'iliyan@genesismodelmgmt.co.uk',
        at: '2024-09-12T12:40:00.000Z',
        thread: 'nb-festive',
      },
      {
        ref: 'GEN-2025-0147',
        channel: 'email',
        direction: 'inbound',
        subject: 'Frame Quarterly editorial — Lisbon',
        body: 'We are producing an editorial with Frame Quarterly in April and would love a new face. Editorial rate, travel covered by us.',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2025-03-03T09:31:00.000Z',
        thread: 'nb-frame',
      },
      {
        ref: 'GEN-2025-0147',
        channel: 'email',
        direction: 'outbound',
        subject: 'Re: Frame Quarterly editorial — Lisbon',
        body: 'Sena Whitfield would be perfect and she is available. Editorial only, no commercial extension without a separate agreement.',
        from: 'Grace Whitmore',
        email: 'grace@genesismodelmgmt.co.uk',
        at: '2025-03-04T11:15:00.000Z',
        thread: 'nb-frame',
      },
      {
        ref: 'GEN-2025-0147',
        channel: 'whatsapp',
        direction: 'inbound',
        subject: 'On set in Lisbon',
        body: 'Shoot went beautifully, Sena was excellent. Thank you for turning this around so quickly.',
        from: 'Hugo Reyes',
        email: 'hugo.reyes@northbankstudios.com',
        at: '2025-04-09T18:22:00.000Z',
        thread: 'nb-frame',
      },
      {
        ref: 'GEN-2026-0203',
        channel: 'email',
        direction: 'inbound',
        subject: 'AW26 — the big one',
        body: 'Grace, AW26 is signed off. Three days in September, two stills and one film day, all media excluding TV, 24 months worldwide. Same cast as spring if they are free, plus Sena.',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2026-06-11T08:05:00.000Z',
        thread: 'nb-aw26',
      },
      {
        ref: 'GEN-2026-0203',
        channel: 'email',
        direction: 'outbound',
        subject: 'Re: AW26 — the big one',
        body: 'All three are available for the 14th to 16th. Fees come to £21,000 plus 20% commission for the usage described. Contracts to follow once you confirm.',
        from: 'Grace Whitmore',
        email: 'grace@genesismodelmgmt.co.uk',
        at: '2026-06-12T13:48:00.000Z',
        thread: 'nb-aw26',
      },
      {
        ref: 'GEN-2026-0203',
        channel: 'email',
        direction: 'inbound',
        subject: 'Re: AW26 — the big one',
        body: 'Confirmed on our side. Please book all three. Ines will pick up the logistics from here.',
        from: 'Freya Lambert',
        email: 'freya.lambert@northbankstudios.com',
        at: '2026-06-15T09:12:00.000Z',
        thread: 'nb-aw26',
      },
      {
        ref: 'GEN-2026-0244',
        channel: 'email',
        direction: 'outbound',
        subject: 'Fitting option — 10 September',
        body: 'Holding all three for a half-day fitting on the 10th. Second option expires 22 August, after which we release.',
        from: 'Iliyan Petrov',
        email: 'iliyan@genesismodelmgmt.co.uk',
        at: '2026-07-24T10:00:00.000Z',
        thread: 'nb-fitting',
      },
      {
        channel: 'email',
        direction: 'outbound',
        subject: 'Statement of account — July 2026',
        body: 'July statement attached. One invoice outstanding (GEN-INV-2026-0188) and nothing overdue. Shout if you need it split by cost centre.',
        from: 'Nathaniel Brooks',
        email: 'accounts@genesismodelmgmt.co.uk',
        at: '2026-07-31T16:05:00.000Z',
        thread: 'nb-accounts',
      },
    ];

    for (const comm of nbComms) {
      insertComm.run({
        id: newId(),
        client_id: northbank,
        booking_id: comm.ref ? nbIds.get(comm.ref) ?? null : null,
        channel: comm.channel,
        direction: comm.direction,
        subject: comm.subject,
        body: comm.body,
        from_name: comm.from,
        from_email: comm.email,
        to_email:
          comm.direction === 'inbound' ? 'bookings@genesismodelmgmt.co.uk' : 'freya.lambert@northbankstudios.com',
        thread_key: comm.thread,
        visible_to_client: comm.internal ? 0 : 1,
        occurred_at: comm.at,
      });
    }

    const nbInvoices = [
      { ref: 'GEN-2023-0184', number: 'GEN-INV-2023-0411', status: 'paid', issued: '2023-08-25', due: '2023-09-24', paid: '2023-09-11', net: 576_000 },
      { ref: 'GEN-2024-0092', number: 'GEN-INV-2024-0155', status: 'paid', issued: '2024-03-18', due: '2024-04-17', paid: '2024-04-15', net: 1_740_000 },
      { ref: 'GEN-2024-0311', number: 'GEN-INV-2024-0498', status: 'paid', issued: '2024-10-04', due: '2024-11-03', paid: '2024-10-29', net: 312_000 },
      { ref: 'GEN-2025-0147', number: 'GEN-INV-2025-0219', status: 'paid', issued: '2025-04-14', due: '2025-05-14', paid: '2025-05-09', net: 384_000 },
      { ref: 'GEN-2026-0203', number: 'GEN-INV-2026-0188', status: 'sent', issued: '2026-07-20', due: '2026-08-19', paid: null, net: 1_260_000 },
    ];

    for (const invoice of nbInvoices) {
      const vat = Math.round(invoice.net * 0.2);
      insertInvoice.run({
        id: newId(),
        client_id: northbank,
        booking_id: nbIds.get(invoice.ref) ?? null,
        number: invoice.number,
        status: invoice.status,
        issued_on: invoice.issued,
        due_on: invoice.due,
        paid_on: invoice.paid,
        net_pence: invoice.net,
        vat_pence: vat,
        total_pence: invoice.net + vat,
        created_at: `${invoice.issued}T09:00:00.000Z`,
      });
    }

    // -- Client two: dormant, with an overdue invoice -------------------------
    const aurelia = newId();
    insertClient.run({
      id: aurelia,
      company_name: 'Aurelia Beauty Group',
      client_type: 'brand',
      status: 'dormant',
      primary_contact_name: 'Priya Raman',
      primary_contact_email: 'priya.raman@aureliabeauty.co',
      phone: '+44 161 496 0188',
      billing_address: '2nd Floor, Wellgate House, Manchester M1 4BT',
      email_domain: 'aureliabeauty.co',
      account_manager: 'Steven Iyer',
      notes: 'Demo record. Nothing booked since early 2025.',
      created_at: '2022-05-03T09:00:00.000Z',
    });

    insertContact.run({
      id: newId(),
      client_id: aurelia,
      full_name: 'Priya Raman',
      email: 'priya.raman@aureliabeauty.co',
      role: 'Marketing Director',
      is_primary: 1,
      created_at: '2022-05-03T09:00:00.000Z',
    });

    const auBookings = [
      {
        reference: 'GEN-2024-0067',
        title: 'Skincare Range — Beauty Stills',
        job_type: 'campaign',
        status: 'completed',
        start_date: '2024-02-19',
        end_date: '2024-02-19',
        location: 'Ancoats Studio, Manchester',
        usage_terms: 'Digital and print, 12 months, UK.',
        fee_pence: 420_000,
        agency_fee_pence: 84_000,
        booker: 'Steven Iyer',
        brief: 'Beauty close-ups, one model, full day.',
        models: [{ name: 'Noor Hassani', board: 'women', role: 'Lead', rate: 420_000, status: 'confirmed' }],
      },
      {
        reference: 'GEN-2025-0031',
        title: 'Valentine Social Films',
        job_type: 'campaign',
        status: 'completed',
        start_date: '2025-01-14',
        end_date: '2025-01-15',
        location: 'Ancoats Studio, Manchester',
        usage_terms: 'Paid and organic social, 6 months, UK.',
        fee_pence: 560_000,
        agency_fee_pence: 112_000,
        booker: 'Steven Iyer',
        brief: 'Two days, two models, short-form vertical.',
        models: [
          { name: 'Noor Hassani', board: 'women', role: 'Lead', rate: 300_000, status: 'confirmed' },
          { name: 'Callum Pryce', board: 'men', role: 'Supporting', rate: 260_000, status: 'confirmed' },
        ],
      },
      {
        reference: 'GEN-2025-0402',
        title: 'Christmas Gifting — cancelled',
        job_type: 'ecommerce',
        status: 'cancelled',
        start_date: '2025-11-06',
        end_date: '2025-11-06',
        location: 'Ancoats Studio, Manchester',
        usage_terms: 'Owned channels, 12 months, UK.',
        fee_pence: 0,
        agency_fee_pence: 0,
        booker: 'Steven Iyer',
        brief: 'Cancelled by the client 16 days out, inside the free-cancellation window.',
        models: [{ name: 'Noor Hassani', board: 'women', role: 'Lead', rate: 0, status: 'released' }],
      },
    ];

    const auIds = new Map<string, string>();
    for (const booking of auBookings) {
      const id = newId();
      auIds.set(booking.reference, id);
      insertBooking.run({
        id,
        client_id: aurelia,
        reference: booking.reference,
        title: booking.title,
        job_type: booking.job_type,
        status: booking.status,
        start_date: booking.start_date,
        end_date: booking.end_date,
        location: booking.location,
        usage_terms: booking.usage_terms,
        fee_pence: booking.fee_pence,
        agency_fee_pence: booking.agency_fee_pence,
        booker: booking.booker,
        brief: booking.brief,
        created_at: `${booking.start_date}T09:00:00.000Z`,
      });
      for (const model of booking.models) {
        insertModel.run({
          id: newId(),
          booking_id: id,
          model_name: model.name,
          board: model.board,
          role: model.role,
          day_rate_pence: model.rate,
          status: model.status,
        });
      }
    }

    for (const comm of [
      {
        ref: 'GEN-2024-0067',
        channel: 'email',
        direction: 'inbound' as const,
        subject: 'Beauty stills in February',
        body: 'Looking for one model for a full day of beauty close-ups on the 19th. Skin needs to be the hero.',
        from: 'Priya Raman',
        email: 'priya.raman@aureliabeauty.co',
        at: '2024-01-15T10:20:00.000Z',
        thread: 'au-skincare',
      },
      {
        ref: 'GEN-2024-0067',
        channel: 'email',
        direction: 'outbound' as const,
        subject: 'Re: Beauty stills in February',
        body: 'Noor Hassani is available and has done a lot of beauty work. Package attached.',
        from: 'Steven Iyer',
        email: 'steven@genesismodelmgmt.co.uk',
        at: '2024-01-15T14:55:00.000Z',
        thread: 'au-skincare',
      },
      {
        ref: 'GEN-2025-0402',
        channel: 'email',
        direction: 'inbound' as const,
        subject: 'Pulling the Christmas shoot',
        body: 'Apologies — budget has been pulled for the November shoot. We will be back in touch when things settle.',
        from: 'Priya Raman',
        email: 'priya.raman@aureliabeauty.co',
        at: '2025-10-21T15:40:00.000Z',
        thread: 'au-xmas',
      },
      {
        channel: 'email',
        direction: 'outbound' as const,
        subject: 'Outstanding invoice GEN-INV-2025-0044',
        body: 'A gentle reminder that GEN-INV-2025-0044 is now past its due date. Happy to arrange a payment plan if that is easier.',
        from: 'Nathaniel Brooks',
        email: 'accounts@genesismodelmgmt.co.uk',
        at: '2026-03-02T09:30:00.000Z',
        thread: 'au-accounts',
      },
    ]) {
      insertComm.run({
        id: newId(),
        client_id: aurelia,
        booking_id: 'ref' in comm && comm.ref ? auIds.get(comm.ref) ?? null : null,
        channel: comm.channel,
        direction: comm.direction,
        subject: comm.subject,
        body: comm.body,
        from_name: comm.from,
        from_email: comm.email,
        to_email: comm.direction === 'inbound' ? 'bookings@genesismodelmgmt.co.uk' : 'priya.raman@aureliabeauty.co',
        thread_key: comm.thread,
        visible_to_client: 1,
        occurred_at: comm.at,
      });
    }

    for (const invoice of [
      { ref: 'GEN-2024-0067', number: 'GEN-INV-2024-0088', status: 'paid', issued: '2024-02-21', due: '2024-03-22', paid: '2024-03-19', net: 504_000 },
      { ref: 'GEN-2025-0031', number: 'GEN-INV-2025-0044', status: 'overdue', issued: '2025-01-20', due: '2025-02-19', paid: null, net: 672_000 },
    ]) {
      const vat = Math.round(invoice.net * 0.2);
      insertInvoice.run({
        id: newId(),
        client_id: aurelia,
        booking_id: auIds.get(invoice.ref) ?? null,
        number: invoice.number,
        status: invoice.status,
        issued_on: invoice.issued,
        due_on: invoice.due,
        paid_on: invoice.paid,
        net_pence: invoice.net,
        vat_pence: vat,
        total_pence: invoice.net + vat,
        created_at: `${invoice.issued}T09:00:00.000Z`,
      });
    }
  });

  build();

  console.info(
    [
      '',
      'Demo data loaded (fictional companies, models and figures).',
      '',
      `  Sign in as an existing client user : hugo.reyes@northbankstudios.com / ${DEMO_PASSWORD}`,
      `  Sign in as Genesis staff           : ops@genesismodelmgmt.co.uk / ${DEMO_PASSWORD}`,
      '',
      '  Register to see history link up    : freya.lambert@northbankstudios.com  (exact match, links automatically)',
      '                                       ines.duarte@northbankstudios.com    (exact match, links automatically)',
      '  Register to see approval queue     : anyone.new@northbankstudios.com     (domain match, needs agency approval)',
      '  Register as a brand new customer   : any other address',
      '',
      '  Verification codes are printed to this terminal and returned by the API outside production.',
      '',
    ].join('\n'),
  );
}
