import 'server-only';
import { all, get, run } from './db';
import { normalizeOrgName, normalizePersonName, phoneDigits } from './normalize';
import type { OrgType } from './constants';

export type Org = { id: number; name: string; type: OrgType; aliases: string; notes: string };
export type ContactRow = {
  id: number;
  name: string;
  role: string;
  organization_id: number | null;
  org_name: string | null;
  assistant_id: number | null;
  assistant_name: string | null;
  notes: string;
  phones: string | null; // ' | ' separated
  last_call: string | null;
  calls_count: number;
};
export type Phone = { id: number; number: string; label: string };
export type Email = { id: number; email: string; label: string };
export type CallRow = {
  id: number;
  occurred_at: string;
  contact_id: number | null;
  contact_name: string | null;
  contact_role: string | null;
  org_id: number | null;
  org_name: string | null;
  spoke_with: string;
  direction: 'out' | 'in';
  result: string;
  details: string;
  is_open: number;
  created_by_name: string | null;
};
export type ContactOption = { id: number; name: string; role: string; org: string };

// ---------- organizations ----------

export function listOrgs(): (Org & { contacts: number; calls: number; norm: string })[] {
  return all(
    `SELECT o.*, (SELECT COUNT(*) FROM contacts c WHERE c.organization_id = o.id) contacts,
            (SELECT COUNT(*) FROM calls k LEFT JOIN contacts c ON c.id = k.contact_id
              WHERE COALESCE(k.organization_id, c.organization_id) = o.id) calls
     FROM organizations o ORDER BY o.name`,
  );
}

export function getOrg(id: number) {
  return get<Org>('SELECT * FROM organizations WHERE id = ?', id);
}

export function findOrgByName(name: string): Org | undefined {
  const norm = normalizeOrgName(name);
  if (!norm) return undefined;
  const direct = get<Org>('SELECT * FROM organizations WHERE norm = ?', norm);
  if (direct) return direct;
  // Aliases are stored one per line.
  return all<Org & { aliases: string }>("SELECT * FROM organizations WHERE aliases <> ''").find((o) =>
    o.aliases.split('\n').some((a) => normalizeOrgName(a) === norm),
  );
}

/** Returns the existing organization for this name (any spelling) or creates a new one. */
export function findOrCreateOrg(name: string, type: OrgType = 'other'): number | null {
  const clean = name.trim();
  if (!clean) return null;
  const existing = findOrgByName(clean);
  if (existing) return existing.id;
  return run('INSERT INTO organizations (name, type, norm) VALUES (?, ?, ?)', clean, type, normalizeOrgName(clean)).id;
}

// ---------- contacts ----------

const CONTACT_SELECT = `
  SELECT c.id, c.name, c.role, c.organization_id, o.name org_name, c.assistant_id, a.name assistant_name, c.notes,
         (SELECT GROUP_CONCAT(p.number, ' | ') FROM contact_phones p WHERE p.contact_id = c.id) phones,
         (SELECT MAX(k.occurred_at) FROM calls k WHERE k.contact_id = c.id) last_call,
         (SELECT COUNT(*) FROM calls k WHERE k.contact_id = c.id) calls_count
  FROM contacts c
  LEFT JOIN organizations o ON o.id = c.organization_id
  LEFT JOIN contacts a ON a.id = c.assistant_id`;

export function listContacts(opts: { q?: string; orgId?: number } = {}): ContactRow[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.orgId) {
    where.push('c.organization_id = ?');
    params.push(opts.orgId);
  }
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    const digits = opts.q.replace(/\D/g, '');
    where.push(
      `(c.name LIKE ? OR c.role LIKE ? OR o.name LIKE ? OR c.notes LIKE ?
        OR EXISTS (SELECT 1 FROM contact_emails e WHERE e.contact_id = c.id AND e.email LIKE ?)
        ${digits.length >= 3 ? 'OR EXISTS (SELECT 1 FROM contact_phones p WHERE p.contact_id = c.id AND p.digits LIKE ?)' : ''})`,
    );
    params.push(q, q, q, q, q);
    if (digits.length >= 3) params.push(`%${digits.replace(/^0/, '')}%`);
  }
  return all(`${CONTACT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.name, c.name`, ...params);
}

export function getContact(id: number) {
  const contact = get<ContactRow>(`${CONTACT_SELECT} WHERE c.id = ?`, id);
  if (!contact) return null;
  return {
    ...contact,
    phoneList: all<Phone>('SELECT id, number, label FROM contact_phones WHERE contact_id = ? ORDER BY id', id),
    emailList: all<Email>('SELECT id, email, label FROM contact_emails WHERE contact_id = ? ORDER BY id', id),
    assistantOf: all<{ id: number; name: string; role: string }>(
      'SELECT id, name, role FROM contacts WHERE assistant_id = ? ORDER BY name',
      id,
    ),
  };
}

export function contactOptions(): ContactOption[] {
  return all(
    `SELECT c.id, c.name, c.role, COALESCE(o.name, '') org FROM contacts c
     LEFT JOIN organizations o ON o.id = c.organization_id ORDER BY c.name`,
  );
}

export type DuplicateHit = { id: number; name: string; role: string; org_name: string | null; reason: string };

/** Possible duplicates: same normalized name, or a shared phone number / email. */
export function findDuplicateContacts(
  input: { name: string; phones: string[]; emails: string[] },
  excludeId?: number,
): DuplicateHit[] {
  const hits = new Map<number, DuplicateHit>();
  const add = (rows: Omit<DuplicateHit, 'reason'>[], reason: string) =>
    rows.forEach((r) => {
      if (r.id !== excludeId && !hits.has(r.id)) hits.set(r.id, { ...r, reason });
    });
  const base = `SELECT c.id, c.name, c.role, o.name org_name FROM contacts c LEFT JOIN organizations o ON o.id = c.organization_id`;
  const norm = normalizePersonName(input.name);
  if (norm) add(all(`${base} WHERE c.norm = ?`, norm), 'אותו שם');
  for (const p of input.phones) {
    const d = phoneDigits(p);
    if (d.length >= 7)
      add(all(`${base} WHERE c.id IN (SELECT contact_id FROM contact_phones WHERE digits = ?)`, d), `אותו טלפון (${p})`);
  }
  for (const e of input.emails) {
    if (e.trim())
      add(
        all(`${base} WHERE c.id IN (SELECT contact_id FROM contact_emails WHERE lower(email) = lower(?))`, e.trim()),
        `אותו מייל (${e})`,
      );
  }
  return [...hits.values()];
}

// ---------- calls ----------

export type CallFilters = {
  from?: string;
  to?: string;
  orgId?: number;
  contactId?: number;
  result?: string;
  open?: 'open' | 'closed';
  q?: string;
  limit?: number;
};

const CALL_SELECT = `
  SELECT k.id, k.occurred_at, k.contact_id, c.name contact_name, c.role contact_role,
         COALESCE(k.organization_id, c.organization_id) org_id, o.name org_name,
         k.spoke_with, k.direction, k.result, k.details, k.is_open, u.name created_by_name
  FROM calls k
  LEFT JOIN contacts c ON c.id = k.contact_id
  LEFT JOIN organizations o ON o.id = COALESCE(k.organization_id, c.organization_id)
  LEFT JOIN users u ON u.id = k.created_by`;

export function listCalls(f: CallFilters = {}): { rows: CallRow[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.from) where.push('k.occurred_at >= ?'), params.push(f.from);
  if (f.to) where.push('k.occurred_at < ?'), params.push(f.to + 'T99');
  if (f.orgId) where.push('COALESCE(k.organization_id, c.organization_id) = ?'), params.push(f.orgId);
  if (f.contactId) where.push('k.contact_id = ?'), params.push(f.contactId);
  if (f.result) where.push('k.result = ?'), params.push(f.result);
  if (f.open === 'open') where.push('k.is_open = 1');
  if (f.open === 'closed') where.push('k.is_open = 0');
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    where.push('(k.details LIKE ? OR k.spoke_with LIKE ? OR c.name LIKE ? OR o.name LIKE ?)');
    params.push(q, q, q, q);
  }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total =
    get<{ n: number }>(
      `SELECT COUNT(*) n FROM calls k LEFT JOIN contacts c ON c.id = k.contact_id
       LEFT JOIN organizations o ON o.id = COALESCE(k.organization_id, c.organization_id) ${w}`,
      ...params,
    )?.n ?? 0;
  const rows = all<CallRow>(`${CALL_SELECT} ${w} ORDER BY k.occurred_at DESC, k.id DESC LIMIT ?`, ...params, f.limit ?? 100);
  return { rows, total };
}

export function getCall(id: number) {
  return get<CallRow>(`${CALL_SELECT} WHERE k.id = ?`, id);
}

export function listUsers() {
  return all<{ id: number; name: string; shift: 'morning' | 'afternoon' }>('SELECT * FROM users ORDER BY shift DESC');
}

// ---------- meeting targets ----------

export type MeetingRow = {
  id: number;
  contact_id: number | null;
  contact_name: string | null;
  contact_role: string | null;
  org_id: number | null;
  org_name: string | null;
  subject: string;
  state: string;
  next_follow_up: string | null;
  deadline: string | null;
  deadline_note: string;
  status_text: string;
  notes: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_place: string;
  materials_asked: number;
  last_contact: string | null;
  updated_at: string;
};

const MEETING_SELECT = `
  SELECT m.*, c.name contact_name, c.role contact_role, c.organization_id org_id, o.name org_name,
         (SELECT MAX(k.occurred_at) FROM calls k WHERE k.contact_id = m.contact_id) last_contact
  FROM meeting_targets m
  LEFT JOIN contacts c ON c.id = m.contact_id
  LEFT JOIN organizations o ON o.id = c.organization_id`;

export function listMeetings(f: { state?: string; q?: string; orgId?: number; contactId?: number } = {}): MeetingRow[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.state) where.push('m.state = ?'), params.push(f.state);
  if (f.orgId) where.push('c.organization_id = ?'), params.push(f.orgId);
  if (f.contactId) where.push('m.contact_id = ?'), params.push(f.contactId);
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    where.push('(c.name LIKE ? OR o.name LIKE ? OR m.subject LIKE ? OR m.status_text LIKE ? OR m.notes LIKE ?)');
    params.push(q, q, q, q, q);
  }
  return all(
    `${MEETING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE WHEN m.next_follow_up IS NULL THEN 1 ELSE 0 END, m.next_follow_up, m.meeting_date, o.name`,
    ...params,
  );
}

export function getMeeting(id: number) {
  return get<MeetingRow>(`${MEETING_SELECT} WHERE m.id = ?`, id);
}

/** Follow-ups due today or earlier (overdue first). */
export function dueFollowUps(today: string): MeetingRow[] {
  return all(
    `${MEETING_SELECT} WHERE m.next_follow_up IS NOT NULL AND m.next_follow_up <= ?
       AND m.state NOT IN ('meeting_set','nothing')
     ORDER BY m.next_follow_up, CASE WHEN m.deadline IS NULL THEN 1 ELSE 0 END, m.deadline`,
    today,
  );
}

export function upcomingMeetings(from: string, to: string): MeetingRow[] {
  return all(
    `${MEETING_SELECT} WHERE m.state = 'meeting_set' AND m.meeting_date BETWEEN ? AND ?
     ORDER BY m.meeting_date, m.meeting_time`,
    from, to,
  );
}

/** Open targets whose deadline is within `days` days. */
export function nearDeadlines(until: string): MeetingRow[] {
  return all(
    `${MEETING_SELECT} WHERE m.deadline IS NOT NULL AND m.deadline <= ? AND m.state NOT IN ('meeting_set','nothing')
     ORDER BY m.deadline`,
    until,
  );
}

// ---------- daily checklist ----------

export type DailyTask = { id: number; title: string; weekdays: string; shift: string; sort: number };

export function listDailyTasks(): DailyTask[] {
  return all('SELECT * FROM daily_tasks ORDER BY sort, id');
}

export function todaysChecklist(date: string, weekdayNum: number) {
  return all<DailyTask & { done_by_name: string | null; done_at: string | null }>(
    `SELECT t.*, u.name done_by_name, k.done_at FROM daily_tasks t
     LEFT JOIN daily_task_checks k ON k.task_id = t.id AND k.date = ?
     LEFT JOIN users u ON u.id = k.done_by
     WHERE t.weekdays = '' OR instr(t.weekdays, ?) > 0
     ORDER BY t.sort, t.id`,
    date, String(weekdayNum),
  );
}

// ---------- shift handover ----------

export type HandoverItem = {
  id: number;
  handover_id: number;
  text: string;
  urgent: number;
  contact_id: number | null;
  contact_name: string | null;
  status: 'pending' | 'received' | 'done';
  updated_at: string | null;
};
export type Handover = {
  id: number;
  from_user: number;
  from_name: string;
  to_user: number;
  to_name: string;
  created_at: string;
  notes: string;
  summary: string;
  acknowledged_at: string | null;
  items: HandoverItem[];
};

function withItems(rows: Omit<Handover, 'items'>[]): Handover[] {
  if (!rows.length) return [];
  const items = all<HandoverItem>(
    `SELECT i.*, c.name contact_name FROM handover_items i LEFT JOIN contacts c ON c.id = i.contact_id
     WHERE i.handover_id IN (${rows.map(() => '?').join(',')}) ORDER BY i.urgent DESC, i.id`,
    ...rows.map((r) => r.id),
  );
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.handover_id === r.id) }));
}

const HANDOVER_SELECT = `
  SELECT h.*, f.name from_name, t.name to_name FROM handovers h
  JOIN users f ON f.id = h.from_user JOIN users t ON t.id = h.to_user`;

/** Handovers addressed to this user that she hasn't marked as read yet. */
export function pendingHandoversFor(userId: number): Handover[] {
  return withItems(all(`${HANDOVER_SELECT} WHERE h.to_user = ? AND h.acknowledged_at IS NULL ORDER BY h.created_at`, userId));
}

export function listHandovers(opts: { q?: string; limit?: number } = {}): Handover[] {
  const params: (string | number)[] = [];
  let where = '';
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    where = 'WHERE h.notes LIKE ? OR EXISTS (SELECT 1 FROM handover_items i WHERE i.handover_id = h.id AND i.text LIKE ?)';
    params.push(q, q);
  }
  return withItems(all(`${HANDOVER_SELECT} ${where} ORDER BY h.created_at DESC LIMIT ?`, ...params, opts.limit ?? 30));
}

/** Items from earlier handovers to this user that are still not done (carry over until done). */
export function openHandoverItemsFor(userId: number) {
  return all<HandoverItem & { from_name: string; created_at: string }>(
    `SELECT i.*, c.name contact_name, f.name from_name, h.created_at FROM handover_items i
     JOIN handovers h ON h.id = i.handover_id JOIN users f ON f.id = h.from_user
     LEFT JOIN contacts c ON c.id = i.contact_id
     WHERE h.to_user = ? AND h.acknowledged_at IS NOT NULL AND i.status <> 'done'
     ORDER BY i.urgent DESC, h.created_at`,
    userId,
  );
}

/** Numbers for the automatic part of the handover: what happened today in my shift. */
export function shiftSummary(userId: number, today: string) {
  const n = (sql: string, ...p: (string | number)[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;
  return {
    calls: n(`SELECT COUNT(*) n FROM calls WHERE created_by = ? AND substr(occurred_at,1,10) = ?`, userId, today),
    openCalls: all<CallRow>(
      `${CALL_SELECT} WHERE k.created_by = ? AND substr(k.occurred_at,1,10) = ? AND k.is_open = 1 ORDER BY k.occurred_at`,
      userId, today,
    ),
    meetingsSet: all<MeetingRow>(
      `${MEETING_SELECT} WHERE m.state = 'meeting_set' AND substr(m.updated_at,1,10) = ?`,
      today,
    ),
    dueNotHandled: dueFollowUps(today),
    tasksLeft: all<{ title: string }>(
      `SELECT t.title FROM daily_tasks t
       WHERE (t.weekdays = '' OR instr(t.weekdays, ?) > 0)
         AND NOT EXISTS (SELECT 1 FROM daily_task_checks k WHERE k.task_id = t.id AND k.date = ?)
       ORDER BY t.sort`,
      String(new Date(today + 'T12:00:00Z').getUTCDay()), today,
    ),
  };
}

export function weekCallCounts(from: string, to: string) {
  return all<{ name: string; n: number }>(
    `SELECT u.name, COUNT(k.id) n FROM users u
     LEFT JOIN calls k ON k.created_by = u.id AND substr(k.occurred_at,1,10) BETWEEN ? AND ?
     GROUP BY u.id ORDER BY u.shift DESC`,
    from, to,
  );
}

// ---------- attachments ----------

export type AttachmentMeta = { id: number; name: string; mime: string; size: number };

export function attachmentMeta(id: number | null | undefined): AttachmentMeta | undefined {
  if (!id) return undefined;
  return get('SELECT id, name, mime, size FROM attachments WHERE id = ?', id);
}

// ---------- appeals committee ----------

export type AppealSession = {
  id: number;
  session_date: string;
  agenda_received: number;
  agenda_link: string;
  agenda_file: number | null;
  agenda_file_name: string | null;
  protocol_received: number;
  protocol_link: string;
  protocol_file: number | null;
  protocol_file_name: string | null;
  decisions_received: number;
  decisions_link: string;
  decisions_file: number | null;
  decisions_file_name: string | null;
  notes: string;
};

const APPEAL_SELECT = `
  SELECT s.*, a1.name agenda_file_name, a2.name protocol_file_name, a3.name decisions_file_name
  FROM appeal_sessions s
  LEFT JOIN attachments a1 ON a1.id = s.agenda_file
  LEFT JOIN attachments a2 ON a2.id = s.protocol_file
  LEFT JOIN attachments a3 ON a3.id = s.decisions_file`;

/** Upcoming sessions first (nearest on top), then past sessions newest first. */
export function listAppeals(today: string): AppealSession[] {
  return all(
    `${APPEAL_SELECT} ORDER BY CASE WHEN s.session_date >= ? THEN 0 ELSE 1 END,
       CASE WHEN s.session_date >= ? THEN s.session_date END ASC, s.session_date DESC`,
    today, today,
  );
}

export function getAppeal(id: number) {
  return get<AppealSession>(`${APPEAL_SELECT} WHERE s.id = ?`, id);
}

// ---------- publications ----------

export type Publication = {
  id: number;
  source: string;
  name: string;
  last_date: string | null;
  has_protocol: number;
  link: string;
  note: string;
  check_weekday: number | null;
  last_checked: string | null;
};

export function listPublications(): Publication[] {
  return all('SELECT * FROM publications ORDER BY source, name');
}

/** Publications that should be checked today (weekly reminder) and weren't checked yet today. */
export function publicationsToCheck(today: string, weekday: number): Publication[] {
  return all(
    `SELECT * FROM publications WHERE check_weekday = ? AND (last_checked IS NULL OR last_checked < ?) ORDER BY source, name`,
    weekday, today,
  );
}

// ---------- notes ("שליפים") ----------

export type Procedure = { id: number; title: string; category: string; content: string; updated_at: string };
export type UsefulPhone = { id: number; name: string; number: string; note: string };
export type DocLink = { id: number; title: string; url: string; attachment_id: number | null; file_name: string | null; notes: string };
export type QuickNote = { id: number; text: string; kind: 'note' | 'shopping'; done: number; created_at: string; done_at: string | null };

export function listProcedures(q?: string): Procedure[] {
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    return all('SELECT * FROM procedures WHERE title LIKE ? OR category LIKE ? OR content LIKE ? ORDER BY category, title', like, like, like);
  }
  return all('SELECT * FROM procedures ORDER BY category, title');
}
export function listUsefulPhones(q?: string): UsefulPhone[] {
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    const digits = q.replace(/\D/g, '');
    return all(
      `SELECT * FROM useful_phones WHERE name LIKE ? OR note LIKE ? OR number LIKE ?
       ${digits.length >= 3 ? "OR replace(replace(number,'-',''),' ','') LIKE ?" : ''} ORDER BY name`,
      ...[like, like, like, ...(digits.length >= 3 ? [`%${digits}%`] : [])],
    );
  }
  return all('SELECT * FROM useful_phones ORDER BY name');
}
export function listDocLinks(q?: string): DocLink[] {
  const base = 'SELECT d.*, a.name file_name FROM doc_links d LEFT JOIN attachments a ON a.id = d.attachment_id';
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    return all(`${base} WHERE d.title LIKE ? OR d.notes LIKE ? OR d.url LIKE ? ORDER BY d.title`, like, like, like);
  }
  return all(`${base} ORDER BY d.title`);
}
export function listQuickNotes(): QuickNote[] {
  return all(
    `SELECT * FROM quick_notes WHERE done = 0 OR done_at >= date('now','localtime','-7 days')
     ORDER BY done, kind, created_at DESC`,
  );
}
export function procedureCategories(): string[] {
  return all<{ category: string }>("SELECT DISTINCT category FROM procedures WHERE category <> '' ORDER BY category").map((r) => r.category);
}

// ---------- tasks given during the day ----------

export type Task = {
  id: number;
  title: string;
  notes: string;
  requested_by: string;
  assignee: number | null;
  assignee_name: string | null;
  due_date: string | null;
  urgent: number;
  contact_id: number | null;
  contact_name: string | null;
  done: number;
  done_by_name: string | null;
  done_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

const TASK_SELECT = `
  SELECT t.*, a.name assignee_name, c.name contact_name, d.name done_by_name, cr.name created_by_name
  FROM tasks t
  LEFT JOIN users a ON a.id = t.assignee
  LEFT JOIN contacts c ON c.id = t.contact_id
  LEFT JOIN users d ON d.id = t.done_by
  LEFT JOIN users cr ON cr.id = t.created_by`;

const TASK_ORDER = `ORDER BY t.urgent DESC, CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at`;

/** Open tasks; with userId – only hers and the shared ones. */
export function openTasks(userId?: number): Task[] {
  return userId
    ? all(`${TASK_SELECT} WHERE t.done = 0 AND (t.assignee IS NULL OR t.assignee = ?) ${TASK_ORDER}`, userId)
    : all(`${TASK_SELECT} WHERE t.done = 0 ${TASK_ORDER}`);
}

export function doneTasks(sinceDays = 14, q?: string): Task[] {
  const like = q?.trim() ? `%${q.trim()}%` : null;
  return all(
    `${TASK_SELECT} WHERE t.done = 1 AND t.done_at >= datetime('now','localtime', ?)
     ${like ? 'AND (t.title LIKE ? OR t.notes LIKE ? OR t.requested_by LIKE ?)' : ''}
     ORDER BY t.done_at DESC`,
    `-${sinceDays} days`, ...(like ? [like, like, like] : []),
  );
}

export function searchTasks(q: string): Task[] {
  const like = `%${q.trim()}%`;
  return all(`${TASK_SELECT} WHERE t.title LIKE ? OR t.notes LIKE ? OR t.requested_by LIKE ? ORDER BY t.done, t.created_at DESC LIMIT 30`, like, like, like);
}

export function getTask(id: number) {
  return get<Task>(`${TASK_SELECT} WHERE t.id = ?`, id);
}

export function requesterSuggestions(): string[] {
  const used = all<{ requested_by: string }>(
    "SELECT requested_by FROM tasks WHERE requested_by <> '' GROUP BY requested_by ORDER BY COUNT(*) DESC LIMIT 10",
  ).map((r) => r.requested_by);
  return [...new Set([...used, 'בועז'])];
}
