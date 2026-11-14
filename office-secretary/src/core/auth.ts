import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dataDirAvailable, get, getSetting, setSetting } from './db';
import { lockStatus, touchLock } from './lock';

const COOKIE = 'office_session';
const MAX_AGE_DAYS = 30;

export type User = { id: number; name: string; shift: 'morning' | 'afternoon' };

function secret(): string {
  let s = getSetting('session_secret');
  if (!s) {
    s = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', s);
  }
  return s;
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string): boolean {
  const stored = getSetting('password_hash');
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

export function isSetUp(): boolean {
  return Boolean(getSetting('password_hash'));
}

export async function startSession(userId: number) {
  const exp = Date.now() + MAX_AGE_DAYS * 86400_000;
  const payload = `${userId}.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [uid, exp, sig] = raw.split('.');
  if (!uid || !exp || !sig) return null;
  const expected = sign(`${uid}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return get<User>('SELECT id, name, shift FROM users WHERE id = ?', Number(uid)) ?? null;
}

/** Use at the top of every protected page and every server action. */
export async function requireUser(): Promise<User> {
  if (!dataDirAvailable()) redirect('/no-drive');
  const u = await currentUser();
  if (!u) redirect('/login');
  // Another computer is working in the system right now → wait screen (protects the shared file).
  if (!lockStatus().free) redirect('/locked');
  touchLock(u.name);
  return u;
}
