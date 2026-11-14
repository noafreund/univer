import { checkedPublicationAction, deletePublicationAction, savePublicationAction } from '@/app/actions/stage3';
import { ConfirmButton } from '@/components/confirm-button';
import { ExportButton } from '@/components/export-button';
import { listPublications, type Publication } from '@/core/data';
import { fmtDate, todayIso } from '@/core/dates';

const SOURCES = ['רמ"י', 'קק"ל', 'ועדת הכלכלה', 'ועדת הכספים', 'ועדת הפנים', 'ועדת הכנסת', 'משרד ראש הממשלה'];
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

function PubFields({ p, sources }: { p?: Publication; sources: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label">מקור</label>
        <select name="source" className="input" defaultValue={p?.source ?? sources[0]}>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__other">אחר...</option>
        </select>
        <input name="sourceOther" className="input mt-1" placeholder="(אם בחרת אחר)" />
      </div>
      <div className="lg:col-span-2">
        <label className="label">שם הפרסום (ישיבה / דו״ח)</label>
        <input name="name" className="input" defaultValue={p?.name} required />
      </div>
      <div>
        <label className="label">תאריך אחרון (בדקתי / יצא)</label>
        <input type="date" name="lastDate" className="input" defaultValue={p?.last_date ?? ''} />
      </div>
      <div className="lg:col-span-2">
        <label className="label">קישור לאתר</label>
        <input name="link" className="input" dir="ltr" defaultValue={p?.link} />
      </div>
      <div>
        <label className="label">תזכורת קבועה לבדיקה</label>
        <select name="checkWeekday" className="input" defaultValue={p?.check_weekday ?? ''}>
          <option value="">בלי</option>
          {WEEKDAYS.map((d, i) => <option key={i} value={i}>כל יום {d}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="hasProtocol" value="1" className="size-4" defaultChecked={p?.has_protocol === 1} />
        יש פרוטוקול
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <label className="label">הערה</label>
        <input name="note" className="input" defaultValue={p?.note} />
      </div>
    </div>
  );
}

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const today = todayIso();
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  const pubs = listPublications();
  const sources = [...new Set([...SOURCES, ...pubs.map((p) => p.source)])];
  const groups = sources.map((s) => ({ source: s, items: pubs.filter((p) => p.source === s) })).filter((g) => g.items.length);
  const editing = pubs.find((p) => String(p.id) === edit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">פרוטוקולים ופרסומים</h1>
        <ExportButton table="publications" />
      </div>

      {groups.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">אין פרסומים במעקב עדיין</p>}
      {groups.map((g) => (
        <section key={g.source} className="card">
          <h2 className="border-b border-slate-100 px-4 py-2 font-semibold">{g.source}</h2>
          <ul className="divide-y divide-slate-100">
            {g.items.map((p) => {
              const dueToday = p.check_weekday === weekday && p.last_checked !== today;
              return (
                <li key={p.id} className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm ${dueToday ? 'bg-amber-50/70' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.name}</span>
                    {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="link ms-2">🔗 לאתר</a>}
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className={`chip ${p.has_protocol ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-slate-100 text-slate-600 ring-slate-300'}`}>
                        {p.has_protocol ? 'יש פרוטוקול' : 'אין עדיין פרוטוקול'}
                      </span>
                      {p.last_date && <span>תאריך אחרון: {fmtDate(p.last_date)}</span>}
                      {p.check_weekday != null && <span>🔁 בודקים כל יום {WEEKDAYS[p.check_weekday]}</span>}
                      {dueToday && <span className="font-bold text-amber-700">לבדוק היום!</span>}
                      {p.note && <span>· {p.note}</span>}
                    </div>
                  </div>
                  <form action={checkedPublicationAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-sm">בדקתי – אין עדיין</button>
                  </form>
                  <form action={checkedPublicationAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="found" value="1" />
                    <button className="btn btn-sm">בדקתי – יצא ✓</button>
                  </form>
                  <a href={`/publications?edit=${p.id}#form`} className="btn btn-sm">עריכה</a>
                  <form action={deletePublicationAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message="למחוק?" className="btn btn-sm btn-danger">✕</ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section id="form" className="card p-4">
        <h2 className="mb-3 font-semibold">{editing ? `עריכת "${editing.name}"` : 'פרסום חדש למעקב'}</h2>
        <form action={savePublicationAction} className="space-y-3" key={editing?.id ?? 'new'}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <PubFields p={editing} sources={sources} />
          <div className="flex gap-2">
            <button className="btn btn-primary">שמירה</button>
            {editing && <a href="/publications" className="btn">ביטול</a>}
          </div>
        </form>
      </section>
    </div>
  );
}
