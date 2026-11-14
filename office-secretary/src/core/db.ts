import 'server-only';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Where the data lives. Priority: OFFICE_DATA_DIR env var → first line of data-folder.txt → ./data
 * (data-folder.txt lets the office point both computers at the shared network drive, e.g. S:\\office-data)
 */
function resolveDataDir(): string {
  if (process.env.OFFICE_DATA_DIR) return process.env.OFFICE_DATA_DIR;
  const cfg = path.join(/* turbopackIgnore: true */ process.cwd(), 'data-folder.txt');
  try {
    const line = fs
      .readFileSync(cfg, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\uFEFF/, '').trim())
      .find((l) => l && !l.startsWith('#'));
    if (line) return line;
  } catch {
    // no config file – use the default
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'data');
}

export const DATA_DIR = path.resolve(resolveDataDir());
export const DB_PATH = path.join(DATA_DIR, 'office.db');

/**
 * Schema migrations. Each entry runs once, in order; PRAGMA user_version tracks progress.
 * Never edit an entry that already shipped — append a new one.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning','afternoon'))
  );

  CREATE TABLE organizations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'other',
    aliases TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    norm TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX organizations_norm ON organizations(norm);

  CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    assistant_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    norm TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX contacts_norm ON contacts(norm);
  CREATE INDEX contacts_org ON contacts(organization_id);

  CREATE TABLE contact_phones (
    id INTEGER PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    digits TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX contact_phones_digits ON contact_phones(digits);

  CREATE TABLE contact_emails (
    id INTEGER PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE calls (
    id INTEGER PRIMARY KEY,
    occurred_at TEXT NOT NULL,              -- 'YYYY-MM-DDTHH:MM' (Israel local time)
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    spoke_with TEXT NOT NULL DEFAULT '',
    direction TEXT NOT NULL CHECK (direction IN ('out','in')),
    result TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    is_open INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX calls_occurred ON calls(occurred_at);
  CREATE INDEX calls_contact ON calls(contact_id);
  `,
  `
  CREATE TABLE meeting_targets (
    id INTEGER PRIMARY KEY,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    subject TEXT NOT NULL DEFAULT 'חלף היטל השבחה',
    state TEXT NOT NULL DEFAULT 'retry_tomorrow',
    next_follow_up TEXT,                    -- 'YYYY-MM-DD' or NULL
    deadline TEXT,
    deadline_note TEXT NOT NULL DEFAULT '',
    status_text TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    meeting_date TEXT,
    meeting_time TEXT,
    meeting_place TEXT NOT NULL DEFAULT '',
    materials_asked INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX meeting_targets_contact ON meeting_targets(contact_id);
  CREATE INDEX meeting_targets_follow ON meeting_targets(next_follow_up);

  CREATE TABLE daily_tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    weekdays TEXT NOT NULL DEFAULT '',      -- digits 0-6 (0 = Sunday); empty = every day
    shift TEXT NOT NULL DEFAULT 'any',      -- any / morning / afternoon
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE daily_task_checks (
    task_id INTEGER NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    done_by INTEGER REFERENCES users(id),
    done_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (task_id, date)
  );
  INSERT INTO daily_tasks (title, weekdays, shift, sort) VALUES
    ('לפתוח חלון / להדליק מזגן', '', 'morning', 1),
    ('לקחת משימות מהמגירה', '', 'any', 2),
    ('לקחת דואר מקומה 1-', '', 'any', 3),
    ('משימה מיוחדת של יום רביעי (לעריכה בהגדרות)', '3', 'any', 4);

  CREATE TABLE handovers (
    id INTEGER PRIMARY KEY,
    from_user INTEGER NOT NULL REFERENCES users(id),
    to_user INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,               -- 'YYYY-MM-DDTHH:MM'
    notes TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',       -- JSON snapshot of the shift numbers
    acknowledged_at TEXT
  );
  CREATE TABLE handover_items (
    id INTEGER PRIMARY KEY,
    handover_id INTEGER NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    urgent INTEGER NOT NULL DEFAULT 0,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending / received / done
    updated_at TEXT
  );
  `,
  `
  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT 'application/octet-stream',
    size INTEGER NOT NULL,
    data BLOB NOT NULL,                     -- stored inside the database so backups include files
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE appeal_sessions (
    id INTEGER PRIMARY KEY,
    session_date TEXT NOT NULL,
    agenda_received INTEGER NOT NULL DEFAULT 0,
    agenda_link TEXT NOT NULL DEFAULT '',
    agenda_file INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
    protocol_received INTEGER NOT NULL DEFAULT 0,
    protocol_link TEXT NOT NULL DEFAULT '',
    protocol_file INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
    decisions_received INTEGER NOT NULL DEFAULT 0,
    decisions_link TEXT NOT NULL DEFAULT '',
    decisions_file INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE publications (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    last_date TEXT,                         -- last date checked / published
    has_protocol INTEGER NOT NULL DEFAULT 0,
    link TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    check_weekday INTEGER,                  -- 0-6: remind to check every week on this day
    last_checked TEXT
  );

  CREATE TABLE procedures (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE useful_phones (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    number TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE doc_links (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    attachment_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE quick_notes (
    id INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note',      -- note / shopping
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    done_at TEXT
  );
  `,
];

/** False when the data folder can't be reached (e.g. the network drive is disconnected). */
export function dataDirAvailable(): boolean {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

type G = typeof globalThis & { __officeDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = user_version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

export function db(): DatabaseSync {
  const g = globalThis as G;
  if (!g.__officeDb) g.__officeDb = open();
  return g.__officeDb;
}

/** Close the connection (used when restoring a backup); the next db() call reopens it. */
export function closeDb() {
  const g = globalThis as G;
  g.__officeDb?.close();
  g.__officeDb = undefined;
}

// node:sqlite returns null-prototype objects; copy them so they can be passed to client components.
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db().prepare(sql).all(...params).map((r) => ({ ...r }) as T);
}
export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  const r = db().prepare(sql).get(...params);
  return r ? ({ ...r } as T) : undefined;
}
export function run(sql: string, ...params: SQLInputValue[]) {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec('BEGIN');
  try {
    const out = fn();
    d.exec('COMMIT');
    return out;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

export function getSetting(key: string): string | undefined {
  return get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}
export function setSetting(key: string, value: string) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
