import 'server-only';
import ExcelJS from 'exceljs';
import { addDays, followUpFor, toWorkday } from './dates';
import { formatPhone, normalizeOrgName, normalizePersonName, phoneDigits } from './normalize';

/**
 * Parses the office's old Excel workbook into clean records.
 * Nothing is written here – the result is shown for approval first (see commitImport).
 */

export type RawCall = {
  row: number;
  date: string;
  time: string;
  direction: 'out' | 'in';
  name: string;
  spokeWith: string;
  role: string;
  org: string;
  phones: { number: string; label: string }[];
  emails: string[];
  details: string;
  result: string;
  isOpen: number;
};
export type RawMeeting = {
  row: number;
  name: string;
  role: string;
  org: string;
  lastContact: string | null;
  statusText: string;
  stateText: string;
  state: string;
  nextFollowUp: string | null;
  deadline: string | null;
  deadlineNote: string;
  notes: string;
  assistant: { name: string; role: string } | null;
};
export type OrgGroup = { key: string; variants: { name: string; count: number }[]; suggested: string };
export type MergeSuggestion = { a: string; b: string; reason: string; defaultOn: boolean };

export type ParsedImport = {
  fileName: string;
  calls: RawCall[];
  meetings: RawMeeting[];
  appeals: { date: string; agenda: boolean; protocol: boolean; decisions: boolean }[];
  publications: { source: string; name: string; link: string; lastDate: string | null; hasProtocol: boolean; note: string; checkWeekday: number | null }[];
  procedures: { title: string; category: string; content: string }[];
  phones: { name: string; number: string; note: string }[];
  docs: { title: string; url: string }[];
  notes: { text: string; kind: 'note' | 'shopping' }[];
  dailyTasks: { title: string; weekdays: string }[];
  orgGroups: OrgGroup[];
  suggestions: MergeSuggestion[];
  skipped: { sheet: string; row: number; reason: string }[];
  redacted: { sheet: string; row: number; reason: string }[];
};

// ---------- cell helpers ----------

type V = ExcelJS.CellValue;

function text(v: V): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String((v as { text: unknown }).text ?? '');
    if ('result' in v) return text((v as { result: V }).result);
    return '';
  }
  return String(v);
}
const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
function link(cell: ExcelJS.Cell): string {
  const v = cell.value as { hyperlink?: string } | null;
  return (typeof v === 'object' && v?.hyperlink) || (cell as unknown as { hyperlink?: string }).hyperlink || '';
}
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function parseDate(v: V): string | null {
  if (v instanceof Date) return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  const m = text(v).match(/(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{2,4})/);
  if (!m) return null;
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  const mo = Number(m[2]), d = Number(m[1]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return iso(y, mo, d);
}

function parseTime(v: V): string | null {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  const m = text(v).match(/(\d{1,2})[:.](\d{2})/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${pad(Number(m[1]))}:${m[2]}`;
}

// ---------- sensitive data ----------

const HEB = '\u0590-\u05FF';
// 4-4-4-4 style card numbers, or 13-19 digits in a row
const CARD = /\b(?:\d{4}[ .-]){3}\d{1,7}\b|\b\d{13,19}\b/;
const ID_WORDS = /ת["״']?ז|תעודת זהות|מס['׳]? רכב/;
const PASSWORD_WORDS = /סיסמ|password|passw|pwd/i;
const STRONG_TOKEN = /(?!https?:)(?=\S*[A-Za-z])(?=\S*\d)(?=\S*[!#$%^&*?])[^\s@]{6,}/g;
// the word "קוד" on its own (not "קודם", "הקודמת") followed by a number
const CODE = new RegExp(`(^|[^${HEB}])(ה?קוד)(?![${HEB}])([^\\d\\n]{0,15})(\\d[\\d*#-]{1,})`, 'g');

/**
 * mode "skip": a row with a password / card / ID is not imported at all (notes sheet).
 * mode "redact": only the sensitive number is removed and the rest is kept (call log – history matters).
 */
function screen(s: string, mode: 'skip' | 'redact'): { text: string; skip?: string; redacted?: string } {
  let t = s;
  const reasons: string[] = [];
  if (PASSWORD_WORDS.test(t) || new RegExp(STRONG_TOKEN.source).test(t)) {
    if (mode === 'skip') return { text: '', skip: 'נראה כמו סיסמה' };
    t = t.replace(STRONG_TOKEN, '[הוסר]');
    reasons.push('סיסמה');
  }
  if (CARD.test(t)) {
    if (mode === 'skip') return { text: '', skip: 'נראה כמו כרטיס אשראי' };
    t = t.replace(new RegExp(CARD.source, 'g'), '[הוסר]');
    reasons.push('מספר כרטיס');
  }
  if (ID_WORDS.test(t)) {
    if (mode === 'skip') return { text: '', skip: 'נראה כמו ת"ז / מספר אישי' };
    const before = t;
    t = t.replace(/\b\d{7,9}\b/g, '[הוסר]');
    if (t !== before) reasons.push('ת"ז / מספר אישי');
  }
  if (new RegExp(CODE.source).test(t)) {
    t = t.replace(CODE, '$1$2$3[הקוד הוסר]');
    reasons.push('קוד');
  }
  return { text: t, redacted: reasons.length ? `הוסר מהטקסט: ${reasons.join(', ')}` : undefined };
}

// ---------- field parsers ----------

const EMAIL = /[\w.%+-]+@(?:[\w-]+\.)+(?:il|com|org|net|gov|info|co|edu|biz|io)\b/gi;

function parsePhones(v: V): { number: string; label: string }[] {
  if (typeof v === 'number') {
    const d = phoneDigits(String(v));
    return [{ number: formatPhone(d), label: d.startsWith('05') ? 'נייד' : '' }];
  }
  const out: { number: string; label: string }[] = [];
  for (const partRaw of text(v).replace(/tel:/gi, '').split(/[\\/,\n]+/)) {
    const part = clean(partRaw);
    if (!part) continue;
    const ext = part.match(/שלוחה\s*(\d+)/)?.[1];
    const rest = part.replace(/שלוחה\s*\d+/, '');
    const nums = rest.match(/\d[\d\s-]{5,}\d/g) ?? [];
    const words = clean(rest.replace(/\d[\d\s-]{5,}\d/g, '').replace(/[^\p{L}\d ]/gu, ''));
    for (const n of nums) {
      const d = phoneDigits(n);
      if (d.length < 7) continue;
      out.push({
        number: formatPhone(d) + (ext ? ` שלוחה ${ext}` : ''),
        label: ext ? 'שלוחה' : words || (d.startsWith('05') ? 'נייד' : ''),
      });
    }
  }
  return out;
}

function splitName(raw: string): { name: string; spokeWith: string } {
  const lines = raw.split(/\n/).map(clean).filter(Boolean);
  let name = (lines[0] ?? '').replace(/\+.*$/, '').trim();
  let spokeWith = lines.slice(1).join(' ');
  const m = name.match(/^ה?(מזכירה|מזכיר|מנהלת הלשכה|מנהלת לשכה|עוזרת|עוזר)\s+של\s+(.+)$/);
  if (m) {
    spokeWith = ['ה' + m[1].replace(/^ה/, ''), spokeWith].filter(Boolean).join(' ');
    name = m[2].trim();
  }
  return { name, spokeWith };
}

function inferResult(details: string): string {
  if (/נקבע|נקבעה|הפגישה מתקיימת|קבענו/.test(details)) return 'meeting_set';
  if (/לא מעוניינ|לא תהיה פגישה|נפסיק להתקשר|להוריד אותם|לא מוכנה להפגש/.test(details)) return 'refused';
  if (/השארתי הודעה/.test(details)) return 'left_message';
  if (/(^|[^\u0590-\u05FF])א["״'.]?\s?מ(?![\u0590-\u05FF])|אין מענה|ללא מענה|לא היה מענה|לא ענו|לא עונ/.test(details)) return 'no_answer';
  return 'spoke';
}

// ---------- meeting states ----------

const MONTHS: Record<string, number> = {
  ינואר: 1, פברואר: 2, מרץ: 3, מרס: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
};
const WEEKDAY_WORDS: Record<string, number> = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5 };

function mapState(stateText: string, base: string): { state: string; date: string | null; approx: boolean } {
  const s = stateText;
  if (/אין (לי )?מה לעשות/.test(s)) return { state: 'nothing', date: null, approx: false };
  if (/נקבעה/.test(s)) return { state: 'meeting_set', date: null, approx: false };
  if (/הם (לחזור|יחזרו)|יחזרו אלינו/.test(s)) return { state: 'they_call_back', date: followUpFor('they_call_back', base), approx: false };
  if (/אני (לחזור|צריכה לחזור)|לחזור אליהם/.test(s)) return { state: 'i_owe_answer', date: base, approx: false };
  if (/מחר/.test(s)) return { state: 'retry_tomorrow', date: followUpFor('retry_tomorrow', base), approx: false };
  if (/שבוע הבא/.test(s)) return { state: 'retry_next_week', date: followUpFor('retry_next_week', base), approx: false };
  const month = Object.keys(MONTHS).find((m) => s.includes(m));
  if (month) {
    const day = /סוף/.test(s) ? 28 : /אמצע/.test(s) ? 15 : 1;
    let y = Number(base.slice(0, 4));
    if (iso(y, MONTHS[month], day) < base) y++;
    return { state: 'retry_on_date', date: toWorkday(iso(y, MONTHS[month], day)), approx: true };
  }
  const wd = Object.keys(WEEKDAY_WORDS).find((w) => s.includes(`יום ${w}`));
  if (wd) {
    let d = addDays(base, 1);
    while (new Date(d + 'T12:00:00Z').getUTCDay() !== WEEKDAY_WORDS[wd]) d = addDays(d, 1);
    return { state: 'retry_on_date', date: d, approx: true };
  }
  if (/חודשים/.test(s)) return { state: 'retry_on_date', date: toWorkday(addDays(base, 90)), approx: true };
  return { state: 'retry_next_week', date: followUpFor('retry_next_week', base), approx: true };
}

// ---------- org grouping ----------

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function buildOrgGroups(names: string[]): { groups: OrgGroup[]; suggestions: MergeSuggestion[] } {
  const map = new Map<string, Map<string, number>>();
  for (const n of names) {
    const name = clean(n);
    const key = normalizeOrgName(name);
    if (!key) continue;
    const g = map.get(key) ?? new Map<string, number>();
    g.set(name, (g.get(name) ?? 0) + 1);
    map.set(key, g);
  }
  const groups: OrgGroup[] = [...map.entries()].map(([key, g]) => {
    const variants = [...g.entries()].map(([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count);
    // Prefer the "official" spelling (with מ.א. / עיריית), otherwise the most common one.
    const official = variants.find((v) => /^(מ\.א\.|מועצה|עיריית|עירית)/.test(v.name));
    return { key, variants, suggested: (official ?? variants[0]).name };
  });
  const suggestions: MergeSuggestion[] = [];
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i].key, b = groups[j].key;
      if (Math.min(a.length, b.length) >= 4 && lev(a, b) === 1)
        suggestions.push({ a, b, reason: 'כמעט אותו שם (שגיאת כתיב?)', defaultOn: true });
      else if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)))
        suggestions.push({ a, b, reason: 'שם אחד מוכל בשני', defaultOn: false });
    }
  return { groups: groups.sort((x, y) => x.suggested.localeCompare(y.suggested, 'he')), suggestions };
}

// ---------- main ----------

export async function parseWorkbook(buf: ArrayBuffer, fileName: string): Promise<ParsedImport> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: ParsedImport = {
    fileName, calls: [], meetings: [], appeals: [], publications: [], procedures: [], phones: [], docs: [], notes: [], dailyTasks: [],
    orgGroups: [], suggestions: [], skipped: [], redacted: [],
  };
  const sheet = (name: string) => wb.worksheets.find((w) => w.name.trim() === name);
  const guard = (sheetName: string, row: number, s: string, mode: 'skip' | 'redact' = 'skip'): string | null => {
    const r = screen(s, mode);
    if (r.skip) {
      out.skipped.push({ sheet: sheetName, row, reason: r.skip });
      return null;
    }
    if (r.redacted) out.redacted.push({ sheet: sheetName, row, reason: r.redacted });
    return r.text;
  };
  const seen = new Set<string>(); // merged cells repeat their text on every row they span
  const once = (key: string) => (seen.has(key) ? false : (seen.add(key), true));

  // ---- calls ----
  const calls = sheet('ניהול שיחות');
  let lastDate: string | null = null;
  calls?.eachRow((r, i) => {
    if (i === 1) return;
    const c = (n: number) => r.getCell(n).value;
    const nameRaw = text(c(4)), detailsRaw = clean(text(c(8)));
    if (!clean(nameRaw) && !detailsRaw) return;
    const date = parseDate(c(2)) ?? lastDate;
    if (!date) return out.skipped.push({ sheet: 'ניהול שיחות', row: i, reason: 'אין תאריך' }) && undefined;
    lastDate = date;
    const timeCell = c(3);
    const timeText = text(timeCell);
    const dirIn = /פנ(ה|תה|ו)\s*אלינו|התקשר(ה)?\s*אלינו/.test(timeText + ' ' + detailsRaw.slice(0, 40));
    const details = guard('ניהול שיחות', i, detailsRaw, 'redact');
    if (details === null) return;
    const times = detailsRaw.match(/\b\d{1,2}:\d{2}\b/g);
    const time = parseTime(timeCell) ?? (times ? parseTime(times[times.length - 1]) : null) ?? '00:00';
    const { name, spokeWith } = splitName(nameRaw);
    let role = clean(text(c(5)));
    let spoke = spokeWith;
    const dib = role.match(/^דיברתי עם\s*(.+)$/);
    if (dib) {
      spoke = [spoke, dib[1]].filter(Boolean).join(' ');
      role = '';
    }
    const statusOrEmail = clean(text(c(9)));
    out.calls.push({
      row: i, date, time, direction: dirIn ? 'in' : 'out', name, spokeWith: spoke, role, org: clean(text(c(6))),
      phones: parsePhones(c(7)), emails: [...new Set(statusOrEmail.match(EMAIL) ?? [])].map((e) => e.toLowerCase()),
      details, result: inferResult(detailsRaw), isOpen: /^פתוח/.test(statusOrEmail) ? 1 : 0,
    });
  });

  // ---- meetings ----
  const meetings = sheet('פגישות');
  meetings?.eachRow((r, i) => {
    if (i === 1) return;
    const c = (n: number) => r.getCell(n).value;
    const nameRaw = text(c(2));
    if (!clean(nameRaw)) return;
    const last = parseDate(c(1));
    const stateText = clean(text(c(6)));
    const base = last ?? new Date().toISOString().slice(0, 10);
    const st = mapState(stateText, base);
    const notesRaw = clean(text(c(7)));
    const dl = notesRaw.match(/לפני[^\d]{0,30}(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    let deadline: string | null = null;
    if (dl) {
      let y = dl[3] ? (Number(dl[3]) < 100 ? 2000 + Number(dl[3]) : Number(dl[3])) : Number(base.slice(0, 4));
      if (!dl[3] && iso(y, Number(dl[2]), Number(dl[1])) < base) y++;
      deadline = iso(y, Number(dl[2]), Number(dl[1]));
    }
    const asst = clean(text(c(8))).match(/^(מנהלת לשכה|מנהלת הלשכה|מזכירה|מזכיר|עוזרת|עוזר)\s+(.+)$/);
    out.meetings.push({
      row: i,
      name: splitName(nameRaw).name,
      role: clean(text(c(3))),
      org: clean(text(c(4))),
      lastContact: last,
      statusText: clean(text(c(5))).replace(/\s*:\|\s*$/, ''),
      stateText,
      state: st.state,
      nextFollowUp: st.date,
      deadline,
      deadlineNote: deadline ? notesRaw : '',
      notes: [deadline ? '' : notesRaw, st.approx ? `מצב באקסל: "${stateText}"` : ''].filter(Boolean).join('\n'),
      assistant: asst ? { role: asst[1], name: asst[2] } : null,
    });
  });

  // ---- appeals ----
  sheet('ועדת השגות')?.eachRow((r, i) => {
    if (i === 1) return;
    const date = parseDate(r.getCell(1).value);
    if (!date) return;
    const yes = (n: number) => r.getCell(n).value === true || /v|✓|כן|true/i.test(text(r.getCell(n).value));
    out.appeals.push({ date, agenda: yes(2), protocol: yes(3), decisions: yes(4) });
  });

  // ---- protocols + notes ----
  const pubs = sheet('פרוטוקולים + פתקים');
  let source = '', sourceLink = '';
  pubs?.eachRow((r, i) => {
    if (i === 1) return;
    const a = clean(text(r.getCell(1).value));
    if (a) {
      source = a.replace(/\s*-\s*ישיבות והחלטות מועצה$/, '');
      sourceLink = link(r.getCell(1));
    }
    const name = clean(text(r.getCell(2).value));
    if (name) {
      const cv = r.getCell(3).value;
      const ct = clean(text(cv));
      const date = parseDate(cv);
      const wd = Object.keys(WEEKDAY_WORDS).find((w) => ct.includes(`יום ${w}`));
      const year = typeof cv === 'number' && cv > 1990 && cv < 2100 ? cv : null;
      out.publications.push({
        source: source || 'אחר',
        name,
        link: link(r.getCell(2)) || sourceLink,
        lastDate: date,
        hasProtocol: Boolean(date) && !/אין/.test(ct),
        note: [year ? `שנה אחרונה: ${year}` : '', /אין/.test(ct) ? ct : '', wd ? ct.replace(/\n/g, ' · ') : ''].filter(Boolean).join(' · '),
        checkWeekday: wd ? WEEKDAY_WORDS[wd] : null,
      });
    }
    const note = clean(text(r.getCell(5).value).replace(/<{3,}\s*/g, ''));
    if (note && i > 1) {
      const t = once('note:' + note) ? guard('פרוטוקולים + פתקים', i, note) : null;
      if (t) out.notes.push({ text: t, kind: /סלוטייפ|טונר|מעטפות|דפים|נייר|עטים|להזמין|לקנות/.test(t) ? 'shopping' : 'note' });
    }
  });

  // ---- "שליפים" ----
  const sh = sheet('שליפים');
  let tasksEnded = false;
  sh?.eachRow((r, i) => {
    // Column A: office tips & procedures
    const a = clean(text(r.getCell(1).value).replace(/\n/g, '\n'));
    if (a && once('A:' + a)) {
      const t = guard('שליפים', i, text(r.getCell(1).value).trim());
      if (t) {
        if (/נגמר|להזמין|לקנות/.test(t) && /טונר|סלוטייפ|מעטפות|נייר/.test(t)) out.notes.push({ text: t, kind: 'shopping' });
        else if (/^[a-z]:\\/i.test(t)) out.procedures.push({ title: 'נתיב מסמך', category: 'כללי', content: t });
        else {
          const first = t.split('\n')[0].split(/[:.]/)[0].trim();
          out.procedures.push({
            title: first.length > 45 ? first.slice(0, 45) + '…' : first,
            category: /הדפס|מדפס/.test(t) ? 'הדפסה' : /ארכיון|קומפקטוס|כריכ|פולדר/.test(t) ? 'ארכיון' : /מייל|אימייל/.test(t) ? 'מיילים'
              : /רמ["״]י/.test(t) ? 'רמ"י' : /תשלומ|קבלות/.test(t) ? 'תשלומים' : /פגיש/.test(t) ? 'פגישות' : 'כללי',
            content: t,
          });
        }
      }
    }
    // Column C: phones, links and info
    const cCell = r.getCell(3);
    const cText = text(cCell.value).trim();
    if (cText && once('C:' + cText)) {
      const url = link(cCell);
      const t = guard('שליפים', i, cText);
      if (t && url) out.docs.push({ title: clean(t), url });
      else if (t) {
        for (const line of t.split('\n').map(clean).filter(Boolean)) {
          const num = line.match(/0\d[\d-]{7,11}/);
          if (!num) {
            out.procedures.push({ title: line.slice(0, 45) + (line.length > 45 ? '…' : ''), category: 'כללי', content: line });
            continue;
          }
          let before = clean(line.slice(0, num.index));
          let prefixNote = '';
          const mine = before.indexOf('המספר שלי');
          if (mine > 0) {
            prefixNote = clean(before.slice(0, mine).replace(/[,\s]+$/, ''));
            before = before.slice(mine);
          }
          before = before.replace(/^(המספר של(?!י)|המספר ב|הטלפון של)\s*/, '');
          const nayad = before.match(/^הנייד של\s*(.+)$/);
          out.phones.push({
            name: nayad ? `${nayad[1]} (נייד)` : before.replace(/[-–:]\s*$/, '') || 'טלפון',
            number: formatPhone(num[0]),
            note: [prefixNote, clean(line.slice((num.index ?? 0) + num[0].length).replace(/^[,\s-]+/, ''))].filter(Boolean).join(' · '),
          });
        }
      }
    }
    // Column E: daily tasks (until the first gap), later cells are shopping items
    const e = clean(text(r.getCell(5).value));
    if (i === 1) return;
    if (!e) {
      if (out.dailyTasks.length) tasksEnded = true;
      return;
    }
    if (!once('E:' + e)) return;
    const t = guard('שליפים', i, e);
    if (!t) return;
    if (tasksEnded) out.notes.push({ text: t, kind: 'shopping' });
    else {
      const wd = Object.keys(WEEKDAY_WORDS).find((w) => t.includes(w));
      out.dailyTasks.push({ title: t, weekdays: wd && /ימי|ביום|יום/.test(t) ? String(WEEKDAY_WORDS[wd]) : '' });
    }
  });

  if (wb.worksheets.some((w) => w.name.includes('סיסמ'))) out.skipped.push({ sheet: 'סיסמאות', row: 0, reason: 'כל הגיליון דולג (סיסמאות לא נשמרות במערכת)' });

  const { groups, suggestions } = buildOrgGroups([...out.calls.map((c) => c.org), ...out.meetings.map((m) => m.org)]);
  out.orgGroups = groups;
  out.suggestions = suggestions;
  return out;
}

export { normalizePersonName };
