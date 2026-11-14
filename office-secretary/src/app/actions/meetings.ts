'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { get, run, tx } from '@/core/db';
import { findOrCreateOrg } from '@/core/data';
import { DEFAULT_SUBJECT, MEETING_STATES } from '@/core/constants';
import { followUpFor, nowParts, todayIso } from '@/core/dates';
import { normalizePersonName } from '@/core/normalize';

export type MeetingFormState = { error?: string } | null;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function saveMeetingAction(fd: FormData): Promise<MeetingFormState> {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  let contactId = Number(fd.get('contactId')) || null;
  const newName = String(fd.get('newContactName') ?? '').trim();
  const state = String(fd.get('state') ?? '');
  if (!(state in MEETING_STATES)) return { error: 'צריך לבחור מצב' };
  if (!contactId && !newName) return { error: 'צריך לבחור איש קשר' };

  const chosen = String(fd.get('nextFollowUp') ?? '');
  const followUp = isDate(chosen) ? chosen : followUpFor(state, todayIso());
  if (state === 'retry_on_date' && !isDate(chosen)) return { error: 'צריך לבחור תאריך לניסיון הבא' };

  const deadline = String(fd.get('deadline') ?? '');
  const meetingDate = String(fd.get('meetingDate') ?? '');
  const meetingTime = String(fd.get('meetingTime') ?? '');
  if (state === 'meeting_set' && !isDate(meetingDate)) return { error: 'צריך למלא את תאריך הפגישה' };

  const savedId = tx(() => {
    if (!contactId) {
      const orgId = findOrCreateOrg(String(fd.get('newContactOrg') ?? ''));
      contactId = run(
        'INSERT INTO contacts (name, role, organization_id, norm, created_by) VALUES (?,?,?,?,?)',
        newName, String(fd.get('newContactRole') ?? '').trim(), orgId, normalizePersonName(newName), user.id,
      ).id;
    }
    const values = [
      contactId,
      String(fd.get('subject') ?? '').trim() || DEFAULT_SUBJECT,
      state,
      state === 'meeting_set' || state === 'nothing' ? null : followUp,
      isDate(deadline) ? deadline : null,
      String(fd.get('deadlineNote') ?? '').trim(),
      String(fd.get('statusText') ?? '').trim(),
      String(fd.get('notes') ?? '').trim(),
      isDate(meetingDate) ? meetingDate : null,
      /^\d{2}:\d{2}$/.test(meetingTime) ? meetingTime : null,
      String(fd.get('meetingPlace') ?? '').trim(),
      fd.get('materialsAsked') === '1' ? 1 : 0,
    ] as const;
    if (id) {
      run(
        `UPDATE meeting_targets SET contact_id=?, subject=?, state=?, next_follow_up=?, deadline=?, deadline_note=?,
           status_text=?, notes=?, meeting_date=?, meeting_time=?, meeting_place=?, materials_asked=?,
           updated_at=datetime('now','localtime') WHERE id=?`,
        ...values, id,
      );
      return id;
    }
    return run(
      `INSERT INTO meeting_targets (contact_id, subject, state, next_follow_up, deadline, deadline_note, status_text, notes,
         meeting_date, meeting_time, meeting_place, materials_asked, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ...values, user.id,
    ).id;
  });
  revalidatePath('/', 'layout');
  redirect(String(fd.get('returnTo') || `/meetings?highlight=${savedId}`));
}

/** Change only the state (kanban drag / quick buttons). Recomputes the follow-up date. */
export async function setMeetingStateAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id'));
  const state = String(fd.get('state'));
  if (!(state in MEETING_STATES)) return;
  if (state === 'meeting_set' || state === 'retry_on_date') {
    // These need extra details (meeting date / chosen date) – open the edit form.
    redirect(`/meetings/${id}?state=${state}`);
  }
  run(
    `UPDATE meeting_targets SET state=?, next_follow_up=?, updated_at=datetime('now','localtime') WHERE id=?`,
    state, followUpFor(state, todayIso()), id,
  );
  revalidatePath('/', 'layout');
}

/**
 * From the "who to call today" list: log the call in the call log and move the follow-up in one click.
 * outcome: no_answer → try again tomorrow; left_message → they'll call back (check in 10 days).
 */
export async function followUpCallAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const outcome = String(fd.get('outcome'));
  const m = get<{ contact_id: number }>('SELECT contact_id FROM meeting_targets WHERE id = ?', id);
  if (!m) return;
  const next = outcome === 'left_message' ? 'they_call_back' : 'retry_tomorrow';
  const now = nowParts();
  tx(() => {
    run(
      `INSERT INTO calls (occurred_at, contact_id, direction, result, details, is_open, created_by) VALUES (?, ?, 'out', ?, ?, 1, ?)`,
      `${now.date}T${now.time}`, m.contact_id, outcome === 'left_message' ? 'left_message' : 'no_answer',
      'ניסיון לקבוע פגישה', user.id,
    );
    run(
      `UPDATE meeting_targets SET state=?, next_follow_up=?, updated_at=datetime('now','localtime') WHERE id=?`,
      next, followUpFor(next, now.date), id,
    );
  });
  revalidatePath('/', 'layout');
}

export async function toggleMaterialsAction(fd: FormData) {
  await requireUser();
  run('UPDATE meeting_targets SET materials_asked = 1 - materials_asked WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
}

export async function deleteMeetingAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM meeting_targets WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
  redirect('/meetings');
}
