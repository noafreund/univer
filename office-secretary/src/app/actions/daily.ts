'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/core/auth';
import { get, run } from '@/core/db';
import { todayIso } from '@/core/dates';

export async function toggleDailyTaskAction(fd: FormData) {
  const user = await requireUser();
  const taskId = Number(fd.get('taskId'));
  const date = todayIso();
  if (get('SELECT 1 x FROM daily_task_checks WHERE task_id = ? AND date = ?', taskId, date)) {
    run('DELETE FROM daily_task_checks WHERE task_id = ? AND date = ?', taskId, date);
  } else {
    run('INSERT INTO daily_task_checks (task_id, date, done_by) VALUES (?, ?, ?)', taskId, date, user.id);
  }
  revalidatePath('/', 'layout');
}

export async function saveDailyTaskAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id')) || null;
  const title = String(fd.get('title') ?? '').trim();
  const weekdays = fd.getAll('weekday').map(String).filter((d) => /^[0-6]$/.test(d)).sort().join('');
  const shift = ['morning', 'afternoon'].includes(String(fd.get('shift'))) ? String(fd.get('shift')) : 'any';
  const sort = Number(fd.get('sort')) || 0;
  if (!title) return;
  // All 5 work days ticked = every day.
  const days = weekdays === '01234' || weekdays === '0123456' ? '' : weekdays;
  if (id) run('UPDATE daily_tasks SET title=?, weekdays=?, shift=?, sort=? WHERE id=?', title, days, shift, sort, id);
  else
    run(
      'INSERT INTO daily_tasks (title, weekdays, shift, sort) VALUES (?,?,?, (SELECT COALESCE(MAX(sort),0)+1 FROM daily_tasks))',
      title, days, shift,
    );
  revalidatePath('/', 'layout');
}

export async function deleteDailyTaskAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM daily_tasks WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
}
