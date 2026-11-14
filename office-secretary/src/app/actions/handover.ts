'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { get, run, tx } from '@/core/db';
import { releaseLock } from '@/core/lock';
import { nowParts } from '@/core/dates';

export type HandoverFormState = { error?: string } | null;

export async function sendHandoverAction(fd: FormData): Promise<HandoverFormState> {
  const user = await requireUser();
  const other = get<{ id: number }>('SELECT id FROM users WHERE id <> ? LIMIT 1', user.id);
  if (!other) return { error: 'לא נמצאה מזכירה שנייה' };
  const texts = fd.getAll('itemText').map(String);
  const urgent = fd.getAll('itemUrgent').map(String);
  const contacts = fd.getAll('itemContact').map(String);
  const items = texts
    .map((t, i) => ({ text: t.trim(), urgent: urgent[i] === '1' ? 1 : 0, contactId: Number(contacts[i]) || null }))
    .filter((i) => i.text);
  const notes = String(fd.get('notes') ?? '').trim();
  if (!items.length && !notes) return { error: 'ההעברה ריקה – צריך להוסיף משימה או הערה' };
  const now = nowParts();
  tx(() => {
    const hid = run(
      'INSERT INTO handovers (from_user, to_user, created_at, notes, summary) VALUES (?,?,?,?,?)',
      user.id, other.id, `${now.date}T${now.time}`, notes, String(fd.get('summary') ?? ''),
    ).id;
    for (const i of items)
      run('INSERT INTO handover_items (handover_id, text, urgent, contact_id) VALUES (?,?,?,?)', hid, i.text, i.urgent, i.contactId);
  });
  revalidatePath('/', 'layout');
  if (fd.get('release') === '1') {
    releaseLock();
    redirect('/released');
  }
  redirect('/handover?sent=1');
}

export async function acknowledgeHandoverAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const now = nowParts();
  tx(() => {
    run('UPDATE handovers SET acknowledged_at = ? WHERE id = ? AND to_user = ?', `${now.date}T${now.time}`, id, user.id);
    // Reading the handover = received every item that wasn't handled yet.
    run(
      "UPDATE handover_items SET status = 'received', updated_at = ? WHERE handover_id = ? AND status = 'pending'",
      `${now.date}T${now.time}`, id,
    );
  });
  revalidatePath('/', 'layout');
}

export async function setHandoverItemAction(fd: FormData) {
  await requireUser();
  const status = String(fd.get('status'));
  if (!['pending', 'received', 'done'].includes(status)) return;
  const now = nowParts();
  run('UPDATE handover_items SET status = ?, updated_at = ? WHERE id = ?', status, `${now.date}T${now.time}`, Number(fd.get('id')));
  revalidatePath('/', 'layout');
}
