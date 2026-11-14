import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR } from './db';
import { HOSTED } from './mode';

/**
 * "One computer at a time" lock.
 *
 * Both secretaries run the app on their own computer against the same database file on the shared
 * network drive. The database is safe on a network drive only if a single computer writes to it,
 * so a small lock file records who is working right now. A lock not refreshed for STALE_MS
 * (computer turned off, app closed) is treated as free.
 */

const LOCK_FILE = path.join(DATA_DIR, 'office.lock');
const STALE_MS = 3 * 60_000;
const REFRESH_MS = 20_000;

export type LockInfo = { id: string; host: string; user: string; at: number };

type G = typeof globalThis & { __officeInstance?: string; __officeLastTouch?: number };
const g = globalThis as G;
const INSTANCE_ID = (g.__officeInstance ??= crypto.randomUUID());

function readLock(): LockInfo | null {
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) as LockInfo;
  } catch {
    return null;
  }
}

function writeLock(user: string) {
  const info: LockInfo = { id: INSTANCE_ID, host: os.hostname(), user, at: Date.now() };
  const tmp = `${LOCK_FILE}.${INSTANCE_ID}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(info));
  fs.renameSync(tmp, LOCK_FILE);
  g.__officeLastTouch = info.at;
}

export type LockStatus = { free: true } | { free: false; holder: LockInfo };

export function lockStatus(): LockStatus {
  if (HOSTED) return { free: true };
  const info = readLock();
  if (!info || info.id === INSTANCE_ID || Date.now() - info.at > STALE_MS) return { free: true };
  return { free: false, holder: info };
}

/** Claim / refresh the lock for this computer (throttled). Call only when lockStatus() is free. */
export function touchLock(user: string) {
  if (HOSTED) return;
  const info = readLock();
  const mine = info?.id === INSTANCE_ID;
  if (mine && info.user === user && Date.now() - (g.__officeLastTouch ?? 0) < REFRESH_MS) return;
  writeLock(user);
}

/** Take the lock even if another computer holds it. */
export function takeLock(user: string) {
  writeLock(user);
}

export function releaseLock() {
  if (readLock()?.id === INSTANCE_ID) {
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      // already gone
    }
  }
}
