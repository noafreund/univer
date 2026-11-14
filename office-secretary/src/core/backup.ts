import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDb, DATA_DIR, db, DB_PATH } from './db';
import { nowParts, todayIso } from './dates';

const KEEP = 30;

/** Main backup folder (next to the data) + optional extra folder, e.g. OneDrive. */
function backupDirs(): string[] {
  const dirs = [path.join(DATA_DIR, 'backups')];
  let extra = process.env.OFFICE_BACKUP_DIR;
  if (!extra) {
    try {
      extra = fs
        .readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), 'backup-folder.txt'), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.replace(/^﻿/, '').trim())
        .find((l) => l && !l.startsWith('#'));
    } catch {
      // no extra folder configured
    }
  }
  if (extra) dirs.push(path.resolve(extra));
  return dirs;
}

export function mainBackupDir() {
  return backupDirs()[0];
}

function snapshot(target: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) fs.unlinkSync(target);
  // VACUUM INTO writes a clean, consistent copy even while the app is running.
  db().prepare('VACUUM INTO ?').run(target);
}

function prune(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^office-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP))) fs.unlinkSync(path.join(dir, f));
}

type G = typeof globalThis & { __officeBackupDay?: string };

/** Make today's backup if it wasn't made yet. Cheap to call on every request. */
export function ensureDailyBackup() {
  const g = globalThis as G;
  const today = todayIso();
  if (g.__officeBackupDay === today) return;
  g.__officeBackupDay = today;
  for (const dir of backupDirs()) {
    try {
      const target = path.join(dir, `office-${today}.db`);
      if (!fs.existsSync(target)) snapshot(target);
      prune(dir);
    } catch (e) {
      console.error('Backup failed for', dir, e);
    }
  }
}

export function listBackups(): { name: string; size: number }[] {
  const dir = mainBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^office-[\w-]+\.db$/.test(f))
    .sort()
    .reverse()
    .map((name) => ({ name, size: fs.statSync(path.join(dir, name)).size }));
}

/** A fresh copy right now, for download. */
export function freshBackupFile(): string {
  const { date, time } = nowParts();
  const target = path.join(mainBackupDir(), 'tmp', `office-${date}-${time.replace(':', '')}.db`);
  snapshot(target);
  return target;
}

export function backupPath(name: string): string | null {
  if (!/^office-[\w-]+\.db$/.test(name)) return null;
  const p = path.join(mainBackupDir(), name);
  return fs.existsSync(p) ? p : null;
}

/** Replace the database with an uploaded backup. The current data is saved first. */
export function restoreFrom(bytes: Uint8Array): string | null {
  if (Buffer.from(bytes.subarray(0, 15)).toString() !== 'SQLite format 3') return 'הקובץ אינו קובץ גיבוי של המערכת';
  const tmp = path.join(DATA_DIR, 'restore-upload.db');
  fs.writeFileSync(tmp, bytes);
  try {
    const test = new DatabaseSync(tmp, { readOnly: true });
    const ok = test.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'").get();
    test.close();
    if (!ok) return 'הקובץ אינו קובץ גיבוי של המערכת';
  } catch {
    fs.rmSync(tmp, { force: true });
    return 'לא הצלחתי לקרוא את הקובץ';
  }
  const { date, time } = nowParts();
  snapshot(path.join(mainBackupDir(), `office-${date}-before-restore-${time.replace(':', '')}.db`));
  closeDb();
  fs.copyFileSync(tmp, DB_PATH);
  fs.rmSync(tmp, { force: true });
  (globalThis as G).__officeBackupDay = undefined;
  return null;
}
