'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { get, run } from '@/core/db';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function saveTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  const title = str(fd, 'title');
  if (!title) return;
  const assigneeRaw = str(fd, 'assignee');
  // "me" (default from the quick form) / a user id / "" = both
  const assignee = assigneeRaw === 'me' ? user.id : get('SELECT id FROM users WHERE id = ?', Number(assigneeRaw)) ? Number(assigneeRaw) : null;
  const due = str(fd, 'due');
  const vals = [
    title, str(fd, 'notes'), str(fd, 'requestedBy'), assignee, isDate(due) ? due : null,
    fd.get('urgent') ? 1 : 0, Number(fd.get('contactId')) || null,
  ] as const;
  if (id) run('UPDATE tasks SET title=?, notes=?, requested_by=?, assignee=?, due_date=?, urgent=?, contact_id=? WHERE id=?', ...vals, id);
  else run('INSERT INTO tasks (title, notes, requested_by, assignee, due_date, urgent, contact_id, created_by) VALUES (?,?,?,?,?,?,?,?)', ...vals, user.id);
  revalidatePath('/', 'layout');
  const back = str(fd, 'returnTo');
  if (back) redirect(back);
}

export async function toggleTaskAction(fd: FormData) {
  const user = await requireUser();
  run(
    `UPDATE tasks SET done = 1 - done,
       done_by = CASE WHEN done = 0 THEN ? END,
       done_at = CASE WHEN done = 0 THEN datetime('now','localtime') END
     WHERE id = ?`,
    user.id, Number(fd.get('id')),
  );
  revalidatePath('/', 'layout');
}

export async function deleteTaskAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM tasks WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
  redirect('/tasks');
}
