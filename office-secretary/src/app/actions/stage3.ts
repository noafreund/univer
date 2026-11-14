'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { restoreFrom } from '@/core/backup';
import { get, run } from "@/core/db";
import { todayIso } from '@/core/dates';
import { pruneAttachments, saveUpload } from '@/core/uploads';

export type SimpleState = { error?: string; ok?: boolean; message?: string } | null;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function done(path = '/') {
  revalidatePath('/', 'layout');
  return redirect(path);
}

// ---------- appeals committee ----------

const DOCS = ['agenda', 'protocol', 'decisions'] as const;

export async function saveAppealAction(_: SimpleState, fd: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  const date = str(fd, 'sessionDate');
  if (!isDate(date)) return { error: 'צריך תאריך ישיבה' };
  const existing = id ? get<Record<string, number | null>>('SELECT * FROM appeal_sessions WHERE id = ?', id) : undefined;
  const values: Record<string, string | number | null> = {};
  for (const d of DOCS) {
    const up = await saveUpload(fd.get(`${d}File`), user.id);
    if (typeof up === 'string') return { error: up };
    const removed = fd.get(`${d}RemoveFile`) === '1';
    values[`${d}_file`] = up ?? (removed ? null : (existing?.[`${d}_file`] ?? null));
    values[`${d}_link`] = str(fd, `${d}Link`);
    // A file or link means it arrived, even if the box wasn't ticked.
    values[`${d}_received`] = fd.get(`${d}Received`) === '1' || values[`${d}_file`] || values[`${d}_link`] ? 1 : 0;
  }
  const cols = Object.keys(values);
  if (id) {
    run(
      `UPDATE appeal_sessions SET session_date = ?, notes = ?, ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      date, str(fd, 'notes'), ...Object.values(values), id,
    );
  } else {
    run(
      `INSERT INTO appeal_sessions (session_date, notes, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`,
      date, str(fd, 'notes'), ...Object.values(values),
    );
  }
  pruneAttachments();
  return done('/appeals');
}

export async function toggleAppealDocAction(fd: FormData) {
  await requireUser();
  const doc = String(fd.get('doc'));
  if (!(DOCS as readonly string[]).includes(doc)) return;
  run(`UPDATE appeal_sessions SET ${doc}_received = 1 - ${doc}_received WHERE id = ?`, Number(fd.get('id')));
  revalidatePath('/', 'layout');
}

export async function deleteAppealAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM appeal_sessions WHERE id = ?', Number(fd.get('id')));
  pruneAttachments();
  done('/appeals');
}

// ---------- publications ----------

export async function savePublicationAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id')) || null;
  const source = str(fd, 'source') === '__other' ? str(fd, 'sourceOther') : str(fd, 'source');
  const name = str(fd, 'name');
  if (!source || !name) return;
  const lastDate = str(fd, 'lastDate');
  const wd = str(fd, 'checkWeekday');
  const vals = [
    source, name, isDate(lastDate) ? lastDate : null, fd.get('hasProtocol') === '1' ? 1 : 0,
    str(fd, 'link'), str(fd, 'note'), /^[0-6]$/.test(wd) ? Number(wd) : null,
  ] as const;
  if (id)
    run('UPDATE publications SET source=?, name=?, last_date=?, has_protocol=?, link=?, note=?, check_weekday=? WHERE id=?', ...vals, id);
  else run('INSERT INTO publications (source, name, last_date, has_protocol, link, note, check_weekday) VALUES (?,?,?,?,?,?,?)', ...vals);
  done('/publications');
}

/** "I checked today": stamps today's date; optionally marks that the protocol is out. */
export async function checkedPublicationAction(fd: FormData) {
  await requireUser();
  const today = todayIso();
  const found = fd.get('found') === '1';
  run(
    `UPDATE publications SET last_checked = ?, last_date = ?, has_protocol = CASE WHEN ? THEN 1 ELSE has_protocol END WHERE id = ?`,
    today, today, found ? 1 : 0, Number(fd.get('id')),
  );
  revalidatePath('/', 'layout');
}

export async function deletePublicationAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM publications WHERE id = ?', Number(fd.get('id')));
  done('/publications');
}

// ---------- procedures / phones / documents / quick notes ----------

export async function saveProcedureAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id')) || null;
  const title = str(fd, 'title');
  if (!title) return;
  const content = String(fd.get('content') ?? '').trim();
  if (id) run("UPDATE procedures SET title=?, category=?, content=?, updated_at=datetime('now','localtime') WHERE id=?", title, str(fd, 'category'), content, id);
  else run('INSERT INTO procedures (title, category, content) VALUES (?,?,?)', title, str(fd, 'category'), content);
  done('/notes?tab=procedures');
}

export async function deleteProcedureAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM procedures WHERE id = ?', Number(fd.get('id')));
  done('/notes?tab=procedures');
}

export async function savePhoneAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id')) || null;
  const name = str(fd, 'name');
  if (!name) return;
  if (id) run('UPDATE useful_phones SET name=?, number=?, note=? WHERE id=?', name, str(fd, 'number'), str(fd, 'note'), id);
  else run('INSERT INTO useful_phones (name, number, note) VALUES (?,?,?)', name, str(fd, 'number'), str(fd, 'note'));
  done('/notes?tab=phones');
}

export async function deletePhoneAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM useful_phones WHERE id = ?', Number(fd.get('id')));
  done('/notes?tab=phones');
}

export async function saveDocAction(_: SimpleState, fd: FormData): Promise<SimpleState> {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  const title = str(fd, 'title');
  if (!title) return { error: 'צריך כותרת' };
  const up = await saveUpload(fd.get('file'), user.id);
  if (typeof up === 'string') return { error: up };
  const url = str(fd, 'url');
  if (id) {
    run(
      'UPDATE doc_links SET title=?, url=?, notes=?, attachment_id = COALESCE(?, attachment_id) WHERE id=?',
      title, url, str(fd, 'notes'), up, id,
    );
  } else {
    if (!up && !url) return { error: 'צריך קישור או קובץ' };
    run('INSERT INTO doc_links (title, url, notes, attachment_id) VALUES (?,?,?,?)', title, url, str(fd, 'notes'), up);
  }
  pruneAttachments();
  return done('/notes?tab=docs');
}

export async function deleteDocAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM doc_links WHERE id = ?', Number(fd.get('id')));
  pruneAttachments();
  done('/notes?tab=docs');
}

export async function addQuickNoteAction(fd: FormData) {
  await requireUser();
  const text = str(fd, 'text');
  const kind = fd.get('kind') === 'shopping' ? 'shopping' : 'note';
  if (text) run('INSERT INTO quick_notes (text, kind) VALUES (?, ?)', text, kind);
  revalidatePath('/', 'layout');
}

export async function toggleQuickNoteAction(fd: FormData) {
  await requireUser();
  run(
    "UPDATE quick_notes SET done = 1 - done, done_at = CASE WHEN done = 0 THEN datetime('now','localtime') END WHERE id = ?",
    Number(fd.get('id')),
  );
  revalidatePath('/', 'layout');
}

export async function deleteQuickNoteAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM quick_notes WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
}

// ---------- restore ----------

export async function restoreBackupAction(_: SimpleState, fd: FormData): Promise<SimpleState> {
  await requireUser();
  if (fd.get('confirm') !== 'שחזור') return { error: 'כדי לאשר צריך להקליד את המילה: שחזור' };
  const file = fd.get('file');
  if (!file || typeof file === 'string' || file.size === 0) return { error: 'צריך לבחור קובץ גיבוי' };
  const err = restoreFrom(new Uint8Array(await file.arrayBuffer()));
  if (err) return { error: err };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'השחזור הצליח. המידע הקודם נשמר כגיבוי למקרה הצורך.' };
}
