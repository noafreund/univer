import Link from 'next/link';
import { toggleAppealDocAction } from '@/app/actions/stage3';
import { AppealForm } from '@/components/appeal-form';
import { ExportButton } from '@/components/export-button';
import { listAppeals, type AppealSession } from '@/core/data';
import { daysBetween, fmtDate, todayIso } from '@/core/dates';

const DOCS = [
  { key: 'agenda', label: 'סדר יום' },
  { key: 'protocol', label: 'פרוטוקול' },
  { key: 'decisions', label: 'החלטות' },
] as const;

function DocCell({ s, d }: { s: AppealSession; d: (typeof DOCS)[number] }) {
  const ok = s[`${d.key}_received`] === 1;
  const file = s[`${d.key}_file`];
  const link = s[`${d.key}_link`];
  return (
    <div className="flex items-center gap-2">
      <form action={toggleAppealDocAction}>
        <input type="hidden" name="id" value={s.id} />
        <input type="hidden" name="doc" value={d.key} />
        <button
          title="לחיצה מחליפה התקבל / לא התקבל"
          className={`flex size-6 cursor-pointer items-center justify-center rounded border text-sm ${ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-300 bg-rose-50 text-rose-500'}`}
        >
          {ok ? '✓' : '✕'}
        </button>
      </form>
      {file && <a href={`/files/${file}`} target="_blank" className="link" title={s[`${d.key}_file_name`] ?? ''}>📎</a>}
      {link && <a href={link} target="_blank" rel="noreferrer" className="link">🔗</a>}
    </div>
  );
}

export default async function AppealsPage() {
  const today = todayIso();
  const sessions = listAppeals(today);
  const next = sessions.find((s) => s.session_date >= today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">ועדת השגות</h1>
        <ExportButton table="appeals" />
      </div>

      {next && (
        <section className="card border-2 border-brand-500 p-4">
          <p className="text-sm text-slate-500">הישיבה הקרובה</p>
          <p className="text-xl font-bold">
            {fmtDate(next.session_date, true)}
            <span className="ms-2 text-base font-normal text-slate-500">
              {daysBetween(today, next.session_date) === 0 ? 'היום!' : `בעוד ${daysBetween(today, next.session_date)} ימים`}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {DOCS.map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-sm">
                <DocCell s={next} d={d} /> {d.label}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="card overflow-x-auto">
        {sessions.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">אין ישיבות עדיין</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>תאריך ישיבה</th>{DOCS.map((d) => <th key={d.key}>{d.label}</th>)}<th className="w-full">הערות</th><th /></tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const missing = DOCS.some((d) => s[`${d.key}_received`] !== 1);
                const past = s.session_date < today;
                return (
                  <tr key={s.id} className={missing && past ? 'bg-rose-50/60' : ''}>
                    <td className="whitespace-nowrap font-medium">
                      {fmtDate(s.session_date)}
                      {missing && past && <div className="text-xs font-normal text-rose-600">חסר משהו</div>}
                      {!past && <div className="text-xs font-normal text-brand-700">עתידית</div>}
                    </td>
                    {DOCS.map((d) => <td key={d.key}><DocCell s={s} d={d} /></td>)}
                    <td className="text-slate-600">{s.notes}</td>
                    <td><Link href={`/appeals/${s.id}`} className="btn btn-sm">עריכה</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">ישיבה חדשה</h2>
        <AppealForm />
      </section>
    </div>
  );
}
