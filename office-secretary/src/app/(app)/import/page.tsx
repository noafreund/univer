import Link from 'next/link';
import { cancelImportAction, commitImportAction } from '@/app/actions/import';
import { DirectionChip, ResultChip, StateChip } from '@/components/badges';
import { getSetting } from '@/core/db';
import { fmtDate } from '@/core/dates';
import { loadPending } from '@/core/import-commit';
import { UploadForm } from './upload-form';

const LABELS: Record<string, string> = {
  orgs: 'ארגונים', contacts: 'אנשי קשר', calls: 'שיחות', meetings: 'יעדי פגישה', appeals: 'ישיבות ועדת השגות',
  publications: 'פרסומים', procedures: 'נהלים', phones: 'טלפונים שימושיים', docs: 'מסמכים וקישורים', notes: 'פתקים', tasks: 'משימות קבועות',
};

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  if (done) {
    const stats = JSON.parse(done) as Record<string, number>;
    return (
      <div className="space-y-4">
        <h1 className="page-title">ייבוא מאקסל</h1>
        <section className="card space-y-3 p-6">
          <p className="text-lg font-semibold text-emerald-700">✓ הייבוא הסתיים בהצלחה</p>
          <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
            {Object.entries(stats).map(([k, v]) => <li key={k}><b>{v}</b> {LABELS[k] ?? k}</li>)}
          </ul>
          <p className="text-sm text-slate-500">לפני הייבוא נשמר גיבוי של המצב הקודם (הגדרות ← גיבויים).</p>
          <div className="flex gap-2">
            <Link href="/" className="btn btn-primary">להיום שלי</Link>
            <Link href="/organizations" className="btn">לבדוק ארגונים</Link>
            <Link href="/meetings" className="btn">לבדוק פגישות</Link>
          </div>
        </section>
      </div>
    );
  }

  const p = loadPending();
  if (!p) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">ייבוא מאקסל</h1>
        <section className="card space-y-3 p-4">
          <p className="text-sm text-slate-600">
            בוחרים את קובץ האקסל הישן של המשרד. המערכת קוראת את הגיליונות &quot;ניהול שיחות&quot;, &quot;פגישות&quot;, &quot;ועדת השגות&quot;,
            &quot;פרוטוקולים + פתקים&quot; ו&quot;שליפים&quot;, ומראה לך הכול לאישור <b>לפני</b> שמירה.
          </p>
          <p className="text-sm text-slate-600">🔒 גיליון &quot;סיסמאות&quot; ושורות שנראות כמו סיסמה, כרטיס אשראי או ת״ז – לא נקראים.</p>
          {getSetting('imported_at') && (
            <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">⚠️ כבר בוצע ייבוא בעבר. ייבוא נוסף של אותו קובץ יכפיל את השיחות.</p>
          )}
          <UploadForm />
        </section>
      </div>
    );
  }

  const multi = p.orgGroups.filter((g) => g.variants.length > 1);
  const single = p.orgGroups.filter((g) => g.variants.length === 1);
  const groupName = (k: string) => p.orgGroups.find((g) => g.key === k)?.suggested ?? k;
  const contactsCount = new Set(p.calls.filter((c) => c.name).map((c) => c.name + '|' + c.org)).size;
  const counts: [string, number][] = [
    ['שיחות', p.calls.length], ['אנשי קשר (בערך)', contactsCount], ['ארגונים', p.orgGroups.length], ['יעדי פגישה', p.meetings.length],
    ['ישיבות ועדת השגות', p.appeals.length], ['פרסומים', p.publications.length], ['נהלים', p.procedures.length],
    ['טלפונים שימושיים', p.phones.length], ['מסמכים וקישורים', p.docs.length], ['פתקים וקניות', p.notes.length], ['משימות קבועות', p.dailyTasks.length],
  ];
  const sample = [...p.calls.slice(0, 6), ...p.calls.slice(-4)];
  const results = p.calls.reduce<Record<string, number>>((a, c) => ((a[c.result] = (a[c.result] ?? 0) + 1), a), {});

  return (
    <form action={commitImportAction} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">ייבוא מאקסל – בדיקה לפני שמירה</h1>
        <span className="text-sm text-slate-500">{p.fileName}</span>
      </div>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">מה נמצא בקובץ</h2>
        <ul className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
          {counts.map(([l, n]) => <li key={l}><b>{n}</b> {l}</li>)}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {Object.entries(results).map(([r, n]) => <span key={r} className="flex items-center gap-1"><ResultChip result={r} />{n}</span>)}
        </div>
      </section>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">דוגמה: כך פירקתי את השיחות (6 ראשונות + 4 אחרונות)</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>שורה</th><th>תאריך</th><th>שעה</th><th>כיוון</th><th>שם</th><th>דיברתי עם</th><th>ארגון</th><th>טלפונים</th><th>מייל</th><th>תוצאה</th></tr></thead>
            <tbody>
              {sample.map((c) => (
                <tr key={c.row}>
                  <td className="text-slate-400">{c.row}</td>
                  <td className="whitespace-nowrap">{fmtDate(c.date)}</td>
                  <td>{c.time === '00:00' ? '—' : c.time}</td>
                  <td><DirectionChip direction={c.direction} /></td>
                  <td className="whitespace-nowrap">{c.name}<div className="text-xs text-slate-400">{c.role}</div></td>
                  <td className="text-slate-500">{c.spokeWith}</td>
                  <td className="whitespace-nowrap">{c.org}</td>
                  <td dir="ltr" className="text-xs whitespace-nowrap">{c.phones.map((x) => x.number + (x.label ? ` (${x.label})` : '')).join(', ')}</td>
                  <td dir="ltr" className="text-xs">{c.emails.join(', ')}</td>
                  <td><ResultChip result={c.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">איחוד ארגונים – לאישורך</h2>
        <p className="mb-3 text-sm text-slate-500">
          אותו ארגון נכתב בכמה צורות. אפשר לשנות את השם הסופי, או לבטל איחוד (להוריד את הסימון).
        </p>
        <div className="space-y-2">
          {multi.map((g) => (
            <div key={g.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <label className="flex items-center gap-1">
                <input type="checkbox" name="merged" value={g.key} defaultChecked className="size-4" /> לאחד
              </label>
              <input name={`name:${g.key}`} defaultValue={g.suggested} className="input w-48 py-1" />
              <span className="text-slate-500">←</span>
              <span className="flex-1 text-slate-600">{g.variants.map((v) => `"${v.name}" (${v.count})`).join(' · ')}</span>
            </div>
          ))}
          {multi.length === 0 && <p className="text-sm text-slate-500">לא נמצאו כתיבים שונים.</p>}
        </div>
        {p.suggestions.length > 0 && (
          <>
            <h3 className="mt-4 mb-2 text-sm font-semibold">שמות דומים – אולי אותו ארגון?</h3>
            <div className="space-y-1">
              {p.suggestions.map((s) => (
                <label key={s.a + s.b} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
                  <input type="checkbox" name="merge" value={`${s.a}|${s.b}`} defaultChecked={s.defaultOn} className="size-4" />
                  לאחד את &quot;{groupName(s.b)}&quot; לתוך &quot;{groupName(s.a)}&quot;
                  <span className="text-xs text-slate-400">({s.reason})</span>
                </label>
              ))}
            </div>
          </>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600">{single.length} ארגונים נוספים (כתיב אחד, בלי שינוי)</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {single.map((g) => <span key={g.key} className="chip bg-slate-50 text-slate-600 ring-slate-200">{g.suggested}</span>)}
          </div>
        </details>
      </section>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">מעקב פגישות – איך תרגמתי את המצבים</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>שם</th><th>ארגון</th><th>מצב באקסל</th><th>מצב במערכת</th><th>מעקב הבא</th><th>מועד יעד</th><th>מזכירה</th></tr></thead>
            <tbody>
              {p.meetings.map((m) => (
                <tr key={m.row}>
                  <td className="whitespace-nowrap">{m.name}</td>
                  <td className="text-slate-600">{m.org}</td>
                  <td className="text-slate-500">{m.stateText}</td>
                  <td><StateChip state={m.state} /></td>
                  <td className="whitespace-nowrap">{fmtDate(m.nextFollowUp)}</td>
                  <td className="whitespace-nowrap text-amber-700">{fmtDate(m.deadline)}</td>
                  <td className="text-slate-600">{m.assistant ? `${m.assistant.name} (${m.assistant.role})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-2 font-semibold">שליפים, פרוטוקולים ופתקים</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium text-slate-600">משימות קבועות</h3>
            <ul className="list-inside list-disc text-slate-700">{p.dailyTasks.map((t) => <li key={t.title}>{t.title}{t.weekdays === '3' && ' (רק ברביעי)'}</li>)}</ul>
            <h3 className="mt-2 font-medium text-slate-600">טלפונים שימושיים</h3>
            <ul className="list-inside list-disc text-slate-700">{p.phones.map((x) => <li key={x.number}>{x.name} – <span dir="ltr">{x.number}</span> {x.note}</li>)}</ul>
            <h3 className="mt-2 font-medium text-slate-600">מסמכים וקישורים</h3>
            <ul className="list-inside list-disc text-slate-700">{p.docs.map((x) => <li key={x.title}>{x.title}</li>)}</ul>
          </div>
          <div>
            <h3 className="font-medium text-slate-600">נהלים ({p.procedures.length})</h3>
            <ul className="list-inside list-disc text-slate-700">{p.procedures.map((x, i) => <li key={i}>[{x.category}] {x.title}</li>)}</ul>
            <h3 className="mt-2 font-medium text-slate-600">פתקים וקניות</h3>
            <ul className="list-inside list-disc text-slate-700">{p.notes.map((x, i) => <li key={i}>{x.kind === 'shopping' ? '🛒' : '📝'} {x.text.slice(0, 80)}</li>)}</ul>
            <h3 className="mt-2 font-medium text-slate-600">פרסומים</h3>
            <ul className="list-inside list-disc text-slate-700">{p.publications.map((x, i) => <li key={i}>{x.source} – {x.name}</li>)}</ul>
          </div>
        </div>
      </section>

      {(p.skipped.length > 0 || p.redacted.length > 0) && (
        <section className="card border-rose-200 p-4 text-sm">
          <h2 className="mb-2 font-semibold">🔒 מה לא יובא (לפי בקשתך)</h2>
          <ul className="space-y-0.5 text-slate-700">
            {p.skipped.map((s, i) => <li key={i}>✕ {s.sheet}{s.row ? `, שורה ${s.row}` : ''} – {s.reason}</li>)}
            {p.redacted.map((s, i) => <li key={`r${i}`}>✂ {s.sheet}, שורה {s.row} – {s.reason}</li>)}
          </ul>
          <p className="mt-2 text-xs text-slate-500">התוכן עצמו לא מוצג כאן בכוונה. אם צריך – לרשום במערכת רק &quot;איפה זה שמור&quot;.</p>
        </section>
      )}

      <div className="sticky bottom-0 flex gap-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <button className="btn btn-primary px-6">✓ אישור וייבוא</button>
        <button formAction={cancelImportAction} formNoValidate className="btn">ביטול</button>
      </div>
    </form>
  );
}
