'use server';

import { redirect } from 'next/navigation';
import {
  clearFailures,
  clientKey,
  endSession,
  hashPassword,
  isSetUp,
  lockedOutMinutes,
  recordFailure,
  requireUser,
  startSession,
  verifyPassword,
} from '@/core/auth';
import { get, run, setSetting, tx } from '@/core/db';

export type FormState = { error?: string; ok?: boolean; message?: string } | null;

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (isSetUp()) return { error: 'המערכת כבר הוגדרה' };
  const key = await clientKey();
  const wait = lockedOutMinutes(key);
  if (wait) return { error: `יותר מדי ניסיונות. נסי שוב בעוד ${wait} דקות` };
  // Phones auto-capitalize and add spaces – compare loosely (also strip quotes someone may have typed into the variable).
  const norm = (v: string) => v.trim().replace(/^["']|["']$/g, '').trim().toLowerCase();
  if (process.env.SETUP_CODE && norm(String(fd.get('setupCode') ?? '')) !== norm(process.env.SETUP_CODE)) {
    recordFailure(key);
    return { error: 'קוד ההתקנה שגוי' };
  }
  const pw = String(fd.get('password') ?? '');
  const pw2 = String(fd.get('password2') ?? '');
  const morning = String(fd.get('morning') ?? '').trim();
  const afternoon = String(fd.get('afternoon') ?? '').trim();
  const me = String(fd.get('me') ?? 'afternoon');
  if (pw.length < 8) return { error: 'הסיסמה צריכה להיות לפחות 8 תווים' };
  if (pw !== pw2) return { error: 'הסיסמאות לא תואמות' };
  if (!morning || !afternoon) return { error: 'צריך למלא את שמות שתי המזכירות' };
  const ids = tx(() => {
    setSetting('password_hash', hashPassword(pw));
    run('DELETE FROM users');
    const m = run("INSERT INTO users (name, shift) VALUES (?, 'morning')", morning).id;
    const a = run("INSERT INTO users (name, shift) VALUES (?, 'afternoon')", afternoon).id;
    return { morning: m, afternoon: a };
  });
  await startSession(me === 'morning' ? ids.morning : ids.afternoon);
  redirect('/');
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const pw = String(fd.get('password') ?? '');
  const userId = Number(fd.get('userId'));
  if (!get('SELECT id FROM users WHERE id = ?', userId)) return { error: 'צריך לבחור מי את' };
  const key = await clientKey();
  const wait = lockedOutMinutes(key);
  if (wait) return { error: `יותר מדי ניסיונות שגויים. נסי שוב בעוד ${wait} דקות` };
  if (!verifyPassword(pw)) {
    recordFailure(key);
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: 'סיסמה שגויה' };
  }
  clearFailures(key);
  await startSession(userId);
  redirect('/');
}

export async function logoutAction() {
  await endSession();
  redirect('/login');
}

export async function switchUserAction(fd: FormData) {
  await requireUser();
  const userId = Number(fd.get('userId'));
  if (get('SELECT id FROM users WHERE id = ?', userId)) await startSession(userId);
  redirect('/');
}

export async function updateSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const morning = String(fd.get('morning') ?? '').trim();
  const afternoon = String(fd.get('afternoon') ?? '').trim();
  if (!morning || !afternoon) return { error: 'צריך למלא את שני השמות' };
  run("UPDATE users SET name = ? WHERE shift = 'morning'", morning);
  run("UPDATE users SET name = ? WHERE shift = 'afternoon'", afternoon);
  const oldPw = String(fd.get('oldPassword') ?? '');
  const newPw = String(fd.get('newPassword') ?? '');
  if (newPw) {
    if (!verifyPassword(oldPw)) return { error: 'הסיסמה הנוכחית שגויה' };
    if (newPw.length < 8) return { error: 'הסיסמה החדשה צריכה להיות לפחות 8 תווים' };
    setSetting('password_hash', hashPassword(newPw));
  }
  return { ok: true, message: 'נשמר' };
}
