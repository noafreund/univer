'use server';

import { redirect } from 'next/navigation';
import { endSession, hashPassword, isSetUp, requireUser, startSession, verifyPassword } from '@/lib/auth';
import { get, run, setSetting, tx } from '@/lib/db';

export type FormState = { error?: string; ok?: boolean; message?: string } | null;

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if (isSetUp()) return { error: 'המערכת כבר הוגדרה' };
  const pw = String(fd.get('password') ?? '');
  const pw2 = String(fd.get('password2') ?? '');
  const morning = String(fd.get('morning') ?? '').trim();
  const afternoon = String(fd.get('afternoon') ?? '').trim();
  const me = String(fd.get('me') ?? 'afternoon');
  if (pw.length < 4) return { error: 'הסיסמה צריכה להיות לפחות 4 תווים' };
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
  if (!verifyPassword(pw)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: 'סיסמה שגויה' };
  }
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
    if (newPw.length < 4) return { error: 'הסיסמה החדשה צריכה להיות לפחות 4 תווים' };
    setSetting('password_hash', hashPassword(newPw));
  }
  return { ok: true, message: 'נשמר' };
}
