'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { get, run, tx } from '@/lib/db';
import { findOrCreateOrg } from '@/lib/data';
import { DIRECTIONS, RESULTS, type Result } from '@/lib/constants';
import { nowParts } from '@/lib/dates';
import { normalizePersonName } from '@/lib/normalize';

export type CallFormState = { ok?: boolean; error?: string; message?: string } | null;

export async function saveCallAction(fd: FormData): Promise<CallFormState> {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  const quickNoAnswer = fd.get('quick') === 'no_answer';
  let contactId = Number(fd.get('contactId')) || null;
  const newContactName = String(fd.get('newContactName') ?? '').trim();
  const newContactOrg = String(fd.get('newContactOrg') ?? '').trim();
  const newContactRole = String(fd.get('newContactRole') ?? '').trim();

  let direction = String(fd.get('direction') ?? 'out');
  let result = String(fd.get('result') ?? '');
  let isOpen = fd.get('isOpen') === '1' ? 1 : 0;
  const now = nowParts();
  let date = String(fd.get('date') ?? '') || now.date;
  let time = String(fd.get('time') ?? '') || now.time;
  if (quickNoAnswer) {
    result = 'no_answer';
    direction = 'out';
    isOpen = 1;
    if (!id) ({ date, time } = now);
  }

  if (!contactId && !newContactName) return { error: 'צריך לבחור איש קשר (או להקליד שם חדש)' };
  if (!(direction in DIRECTIONS)) return { error: 'כיוון לא תקין' };
  if (!(result in RESULTS)) return { error: 'צריך לבחור מה הייתה התוצאה' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: 'תאריך או שעה לא תקינים' };

  const label = tx(() => {
    if (!contactId) {
      const orgId = findOrCreateOrg(newContactOrg);
      const norm = normalizePersonName(newContactName);
      const existing = get<{ id: number }>(
        'SELECT id FROM contacts WHERE norm = ? AND organization_id IS ?',
        norm, orgId,
      );
      contactId =
        existing?.id ??
        run(
          'INSERT INTO contacts (name, role, organization_id, norm, created_by) VALUES (?,?,?,?,?)',
          newContactName, newContactRole, orgId, norm, user.id,
        ).id;
    }
    const occurred = `${date}T${time}`;
    const spokeWith = String(fd.get('spokeWith') ?? '').trim();
    const details = String(fd.get('details') ?? '').trim();
    if (id) {
      run(
        'UPDATE calls SET occurred_at=?, contact_id=?, spoke_with=?, direction=?, result=?, details=?, is_open=? WHERE id=?',
        occurred, contactId, spokeWith, direction, result, details, isOpen, id,
      );
    } else {
      run(
        `INSERT INTO calls (occurred_at, contact_id, spoke_with, direction, result, details, is_open, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        occurred, contactId, spokeWith, direction, result, details, isOpen, user.id,
      );
    }
    return get<{ name: string }>('SELECT name FROM contacts WHERE id = ?', contactId)?.name ?? '';
  });

  revalidatePath('/', 'layout');
  if (id) redirect(String(fd.get('returnTo') || '/calls'));
  return { ok: true, message: `נשמר: ${label} – ${RESULTS[result as Result].label} (${time})` };
}

/** One-click "no answer" for a contact, from any list. */
export async function quickNoAnswerAction(fd: FormData) {
  const user = await requireUser();
  const contactId = Number(fd.get('contactId'));
  if (!get('SELECT id FROM contacts WHERE id = ?', contactId)) return;
  const now = nowParts();
  run(
    `INSERT INTO calls (occurred_at, contact_id, direction, result, is_open, created_by) VALUES (?, ?, 'out', 'no_answer', 1, ?)`,
    `${now.date}T${now.time}`, contactId, user.id,
  );
  revalidatePath('/', 'layout');
}

export async function toggleCallOpenAction(fd: FormData) {
  await requireUser();
  run('UPDATE calls SET is_open = 1 - is_open WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
}

export async function deleteCallAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM calls WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
}
