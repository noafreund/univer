import 'server-only';
import ExcelJS from 'exceljs';
import { all } from './db';
import { DIRECTIONS, MEETING_STATES, ORG_TYPES, RESULTS } from './constants';
import { fmtDate } from './dates';

type Col = { header: string; key: string; width?: number };
type Sheet = { title: string; columns: Col[]; rows: () => Record<string, unknown>[] };

const lbl = <T extends Record<string, unknown>>(map: T, k: unknown) => {
  const v = map[k as keyof T];
  return typeof v === 'string' ? v : (v as { label?: string } | undefined)?.label ?? String(k ?? '');
};
const yesNo = (v: unknown) => (v ? 'כן' : 'לא');
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export const SHEETS: Record<string, Sheet> = {
  contacts: {
    title: 'אנשי קשר',
    columns: [
      { header: 'שם', key: 'name', width: 22 },
      { header: 'תפקיד', key: 'role', width: 18 },
      { header: 'ארגון', key: 'org', width: 22 },
      { header: 'טלפונים', key: 'phones', width: 30 },
      { header: 'מיילים', key: 'emails', width: 30 },
      { header: 'מזכירה / מנהלת לשכה', key: 'assistant', width: 18 },
      { header: 'הערות', key: 'notes', width: 40 },
    ],
    rows: () =>
      all(`SELECT c.name, c.role, o.name org, a.name assistant, c.notes,
             (SELECT GROUP_CONCAT(p.number || CASE WHEN p.label <> '' THEN ' (' || p.label || ')' ELSE '' END, ' | ') FROM contact_phones p WHERE p.contact_id = c.id) phones,
             (SELECT GROUP_CONCAT(e.email, ' | ') FROM contact_emails e WHERE e.contact_id = c.id) emails
           FROM contacts c LEFT JOIN organizations o ON o.id = c.organization_id LEFT JOIN contacts a ON a.id = c.assistant_id
           ORDER BY o.name, c.name`),
  },
  organizations: {
    title: 'ארגונים',
    columns: [
      { header: 'שם', key: 'name', width: 26 },
      { header: 'סוג', key: 'type', width: 16 },
      { header: 'שמות נוספים', key: 'aliases', width: 30 },
      { header: 'הערות', key: 'notes', width: 40 },
    ],
    rows: () =>
      all<Record<string, unknown>>('SELECT name, type, aliases, notes FROM organizations ORDER BY name').map((r) => ({
        ...r,
        type: lbl(ORG_TYPES, r.type),
        aliases: String(r.aliases).split('\n').join(', '),
      })),
  },
  calls: {
    title: 'יומן שיחות',
    columns: [
      { header: 'תאריך', key: 'date', width: 10 },
      { header: 'שעה', key: 'time', width: 7 },
      { header: 'איש קשר', key: 'contact', width: 20 },
      { header: 'ארגון', key: 'org', width: 20 },
      { header: 'עם מי דיברתי', key: 'spoke_with', width: 14 },
      { header: 'כיוון', key: 'direction', width: 12 },
      { header: 'תוצאה', key: 'result', width: 13 },
      { header: 'פירוט', key: 'details', width: 50 },
      { header: 'פתוח/סגור', key: 'open', width: 9 },
      { header: 'תועד ע"י', key: 'by', width: 10 },
    ],
    rows: () =>
      all<Record<string, string | number>>(
        `SELECT k.occurred_at, c.name contact, o.name org, k.spoke_with, k.direction, k.result, k.details, k.is_open, u.name by_name
         FROM calls k LEFT JOIN contacts c ON c.id = k.contact_id
         LEFT JOIN organizations o ON o.id = COALESCE(k.organization_id, c.organization_id)
         LEFT JOIN users u ON u.id = k.created_by ORDER BY k.occurred_at DESC`,
      ).map((r) => ({
        ...r,
        date: fmtDate(String(r.occurred_at)),
        time: String(r.occurred_at).slice(11, 16),
        direction: lbl(DIRECTIONS, r.direction),
        result: lbl(RESULTS, r.result),
        open: r.is_open ? 'פתוח' : 'סגור',
        by: r.by_name,
      })),
  },
  meetings: {
    title: 'פגישות',
    columns: [
      { header: 'איש קשר', key: 'contact', width: 20 },
      { header: 'תפקיד', key: 'role', width: 16 },
      { header: 'ארגון', key: 'org', width: 20 },
      { header: 'נושא', key: 'subject', width: 18 },
      { header: 'מצב', key: 'state', width: 22 },
      { header: 'מעקב הבא', key: 'next', width: 10 },
      { header: 'פנייה אחרונה', key: 'last', width: 11 },
      { header: 'מועד יעד', key: 'deadline', width: 10 },
      { header: 'הערת מועד', key: 'deadline_note', width: 20 },
      { header: 'תאריך פגישה', key: 'mdate', width: 11 },
      { header: 'שעה', key: 'meeting_time', width: 7 },
      { header: 'מקום', key: 'meeting_place', width: 16 },
      { header: 'נשאל על חומרים', key: 'materials', width: 9 },
      { header: 'סטטוס', key: 'status_text', width: 30 },
      { header: 'הערות', key: 'notes', width: 30 },
    ],
    rows: () =>
      all<Record<string, string | number | null>>(
        `SELECT m.*, c.name contact, c.role, o.name org,
           (SELECT MAX(k.occurred_at) FROM calls k WHERE k.contact_id = m.contact_id) last_contact
         FROM meeting_targets m LEFT JOIN contacts c ON c.id = m.contact_id LEFT JOIN organizations o ON o.id = c.organization_id
         ORDER BY o.name, c.name`,
      ).map((r) => ({
        ...r,
        state: lbl(MEETING_STATES, r.state),
        next: fmtDate(r.next_follow_up as string),
        last: fmtDate(r.last_contact as string),
        deadline: fmtDate(r.deadline as string),
        mdate: fmtDate(r.meeting_date as string),
        materials: yesNo(r.materials_asked),
      })),
  },
  appeals: {
    title: 'ועדת השגות',
    columns: [
      { header: 'תאריך ישיבה', key: 'date', width: 11 },
      { header: 'סדר יום', key: 'agenda', width: 9 },
      { header: 'פרוטוקול', key: 'protocol', width: 9 },
      { header: 'החלטות', key: 'decisions', width: 9 },
      { header: 'קישורים', key: 'links', width: 50 },
      { header: 'הערות', key: 'notes', width: 30 },
    ],
    rows: () =>
      all<Record<string, string | number>>('SELECT * FROM appeal_sessions ORDER BY session_date DESC').map((r) => ({
        date: fmtDate(String(r.session_date)),
        agenda: yesNo(r.agenda_received),
        protocol: yesNo(r.protocol_received),
        decisions: yesNo(r.decisions_received),
        links: [r.agenda_link, r.protocol_link, r.decisions_link].filter(Boolean).join(' | '),
        notes: r.notes,
      })),
  },
  publications: {
    title: 'פרוטוקולים ופרסומים',
    columns: [
      { header: 'מקור', key: 'source', width: 20 },
      { header: 'שם', key: 'name', width: 30 },
      { header: 'תאריך אחרון', key: 'date', width: 11 },
      { header: 'סטטוס', key: 'status', width: 16 },
      { header: 'בדיקה קבועה', key: 'weekday', width: 10 },
      { header: 'קישור', key: 'link', width: 40 },
      { header: 'הערה', key: 'note', width: 30 },
    ],
    rows: () =>
      all<Record<string, string | number | null>>('SELECT * FROM publications ORDER BY source, name').map((r) => ({
        ...r,
        date: fmtDate(r.last_date as string),
        status: r.has_protocol ? 'יש' : 'אין עדיין פרוטוקול',
        weekday: r.check_weekday == null ? '' : `כל יום ${WEEKDAYS[Number(r.check_weekday)]}`,
      })),
  },
  procedures: {
    title: 'נהלים',
    columns: [
      { header: 'קטגוריה', key: 'category', width: 14 },
      { header: 'כותרת', key: 'title', width: 26 },
      { header: 'תוכן', key: 'content', width: 80 },
    ],
    rows: () => all('SELECT category, title, content FROM procedures ORDER BY category, title'),
  },
  phones: {
    title: 'טלפונים שימושיים',
    columns: [
      { header: 'שם', key: 'name', width: 24 },
      { header: 'מספר', key: 'number', width: 16 },
      { header: 'הערה', key: 'note', width: 40 },
    ],
    rows: () => all('SELECT name, number, note FROM useful_phones ORDER BY name'),
  },
  docs: {
    title: 'מסמכים וקישורים',
    columns: [
      { header: 'כותרת', key: 'title', width: 30 },
      { header: 'קישור', key: 'url', width: 40 },
      { header: 'קובץ מצורף', key: 'file', width: 24 },
      { header: 'הערות', key: 'notes', width: 30 },
    ],
    rows: () => all('SELECT d.title, d.url, a.name file, d.notes FROM doc_links d LEFT JOIN attachments a ON a.id = d.attachment_id ORDER BY d.title'),
  },
  tasks: {
    title: 'משימות',
    columns: [
      { header: 'משימה', key: 'title', width: 40 },
      { header: 'מי ביקש', key: 'requested_by', width: 12 },
      { header: 'למי', key: 'assignee', width: 10 },
      { header: 'עד מתי', key: 'due', width: 10 },
      { header: 'דחוף', key: 'urgent', width: 7 },
      { header: 'בוצע', key: 'done', width: 7 },
      { header: 'פרטים', key: 'notes', width: 40 },
    ],
    rows: () =>
      all<Record<string, string | number | null>>(
        'SELECT t.*, u.name assignee_name FROM tasks t LEFT JOIN users u ON u.id = t.assignee ORDER BY t.done, t.due_date',
      ).map((r) => ({
        ...r,
        assignee: r.assignee_name ?? 'שתינו',
        due: fmtDate(r.due_date as string),
        urgent: yesNo(r.urgent),
        done: yesNo(r.done),
      })),
  },
  notes: {
    title: 'פתקים וקניות',
    columns: [
      { header: 'סוג', key: 'kind', width: 8 },
      { header: 'טקסט', key: 'text', width: 50 },
      { header: 'בוצע', key: 'done', width: 7 },
      { header: 'נוצר', key: 'created', width: 11 },
    ],
    rows: () =>
      all<Record<string, string | number>>('SELECT * FROM quick_notes ORDER BY done, created_at DESC').map((r) => ({
        kind: r.kind === 'shopping' ? 'קניות' : 'פתק',
        text: r.text,
        done: yesNo(r.done),
        created: fmtDate(String(r.created_at)),
      })),
  },
};

function addSheet(wb: ExcelJS.Workbook, s: Sheet) {
  const ws = wb.addWorksheet(s.title.slice(0, 31), { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2F1' } };
  ws.addRows(s.rows());
  ws.eachRow((row) => (row.alignment = { vertical: 'top', wrapText: true }));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
}

export async function buildWorkbook(keys: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'המשרד';
  for (const k of keys) addSheet(wb, SHEETS[k]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
