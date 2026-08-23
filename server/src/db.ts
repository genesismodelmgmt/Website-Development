import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');

/**
 * A relative DATABASE_FILE is resolved against the server package, not the
 * working directory — otherwise `npm run seed` (cwd: server/) and a server
 * started from the repo root quietly open two different databases.
 */
export function resolveDatabasePath(file: string): string {
  if (file === ':memory:' || isAbsolute(file)) return file;
  return resolve(packageRoot, file);
}

export type Db = Database.Database;

let instance: Db | null = null;

export function openDatabase(configured = env.databaseFile): Db {
  const file = resolveDatabasePath(configured);
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/**
 * The schema is idempotent (CREATE TABLE IF NOT EXISTS), so applying it on every
 * boot is the migration step for now. A real deployment would move to numbered
 * migration files before the first schema change lands on live data.
 */
export function migrate(db: Db): void {
  // Resolve from source in dev (tsx) and from dist in production, where the
  // build copies schema.sql alongside the compiled output.
  const candidates = [join(here, 'schema.sql'), join(here, '..', 'src', 'schema.sql')];
  let sql: string | null = null;
  for (const candidate of candidates) {
    try {
      sql = readFileSync(candidate, 'utf8');
      break;
    } catch {
      // try the next candidate
    }
  }
  if (!sql) throw new Error(`Could not locate schema.sql (looked in: ${candidates.join(', ')})`);
  db.exec(sql);
}

export function getDb(): Db {
  if (!instance) instance = openDatabase();
  return instance;
}

/** Test hook: lets a suite swap in an in-memory database. */
export function setDb(db: Db): void {
  instance = db;
}

export const newId = (): string => randomUUID();

export const nowIso = (): string => new Date().toISOString();

export function recordAudit(
  db: Db,
  entry: {
    actorUserId?: string | null;
    actorEmail?: string | null;
    action: string;
    subjectType?: string | null;
    subjectId?: string | null;
    detail?: string | null;
    ip?: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO audit_log (id, actor_user_id, actor_email, action, subject_type, subject_id, detail, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    entry.actorUserId ?? null,
    entry.actorEmail ?? null,
    entry.action,
    entry.subjectType ?? null,
    entry.subjectId ?? null,
    entry.detail ?? null,
    entry.ip ?? null,
    nowIso(),
  );
}
