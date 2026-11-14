import Link from 'next/link';
import { toggleDailyTaskAction } from '@/app/actions/daily';
import { checkedPublicationAction } from '@/app/actions/stage3';
import { followUpCallAction, toggleMaterialsAction } from '@/app/actions/meetings';
import { StateChip } from '@/components/badges';
import { CallForm } from '@/components/call-form';
import { CallsTable } from '@/components/calls-table';
import { HandoverCard } from '@/components/handover-card';
import { requireUser } from '@/core/auth';
import {
  contactOptions,
  dueFollowUps,
  listAppeals,
  listCalls,
  listQuickNotes,
  publicationsToCheck,
  listOrgs,
  nearDeadlines,
  openHandoverItemsFor,
  pendingHandoversFor,
  todaysChecklist,
  upcomingMeetings,
  weekCallCounts,
} from '@/core/data';
import { addDays, daysBetween, fmtDate, fmtTime, startOfWeek, todayIso } from '@/core/dates';

export default async function HomePage() {
  const user = await requireUser();
  const today = todayIso();
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  const weekStart = startOfWeek(today);

  const handovers = pendingHandoversFor(user.id);
  const carried = openHandoverItemsFor(user.id);
  const due = dueFollowUps(today);
  const meetings = upcomingMeetings(today, addDays(today, 7));
  const deadlines = nearDeadlines(addDays(today, 7));
  const checklist = todaysChecklist(today, weekday).filter((t) => t.shift === 'any' || t.shift === user.shift);
  const weekCounts = weekCallCounts(weekStart, addDays(weekStart, 6));
  const todays = listCalls({ from: today, to: today, limit: 50 });
  const weekTotal = weekCounts.reduce((a, b) => a + b.n, 0);
  const pubsToCheck = publicationsToCheck(today, weekday);
  const nextAppeal = listAppeals(today).find((a) => a.session_date >= today && a.session_date <= addDays(today, 14));
  const appealMissing = nextAppeal
    ? [['agenda', 'סדר יום'], ['protocol', 'פרוטוקול'], ['decisions', 'החלטות']]
        .filter(([k]) => nextAppeal[`${k}_received` as 'agenda_received'] !== 1)
        .map(([, l]) => l)
    : [];
  const shopping = listQuickNotes().filter((n) => n.kind === 'shopping' && !n.done);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">היום שלי</h1>
        <p className="text-sm text-slate-500">{fmtDate(today, true)} · {user.name}</p>
      </div>

      {handovers.map((h) => <HandoverCard key={h.id} h={h} meId={user.id} highlight />)}
      {carried.length > 0 && (
        <Link href="/handover" className="card block border-sky-300 bg-sky-50/50 p-3 text-sm">
          📌 יש {carried.length} משימות מהעברות משמרת שעוד לא בוצעו ←
        </Link>
      )}

      {(pubsToCheck.length > 0 || nextAppeal || shopping.length > 0) && (
        <section className="card space-y-2 p-4 text-sm">
          {pubsToCheck.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <span>📰 לבדוק היום: <b>{p.source}</b> – {p.name}</span>
              {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="link">🔗 לאתר</a>}
              <form action={checkedPublicationAction}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn-sm">בדקתי – אין עדיין</button>
              </form>
              <form action={checkedPublicationAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="found" value="1" />
                <button className="btn btn-sm">יצא ✓</button>
              </form>
            </div>
          ))}
          {nextAppeal && (
            <div>
              ⚖️ ועדת השגות ב-<Link href="/appeals" className="link font-medium">{fmtDate(nextAppeal.session_date, true)}</Link>
              {appealMissing.length > 0 ? (
                <span className="text-rose-600"> · עוד לא התקבל: {appealMissing.join(', ')}</span>
              ) : (
                <span className="text-emerald-700"> · הכול התקבל ✓</span>
              )}
            </div>
          )}
          {shopping.length > 0 && (
            <div>
              🛒 <Link href="/notes" className="link">לקנות למשרד</Link>: {shopping.map((n) => n.text).join(', ')}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Who to call */}
        <section className="card lg:col-span-2">
          <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-3 font-semibold">
            למי להתקשר היום
            <span className="text-sm font-normal text-slate-500">{due.length}</span>
          </h2>
          {due.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">אין מעקבים להיום 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {due.map((m) => {
                const late = daysBetween(m.next_follow_up!, today);
                return (
                  <li key={m.id} className={`flex flex-wrap items-center gap-2 px-4 py-2 ${late > 0 ? 'bg-rose-50/60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <Link href={`/contacts/${m.contact_id}`} className="link font-medium">{m.contact_name}</Link>
                      <span className="ms-1 text-sm text-slate-500">{[m.contact_role, m.org_name].filter(Boolean).join(' · ')}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <StateChip state={m.state} />
                        {late > 0 && <span className="font-bold text-rose-600">באיחור {late} ימים</span>}
                        {m.deadline && <span className="text-amber-700">⏰ יעד {fmtDate(m.deadline)} {m.deadline_note}</span>}
                        {m.status_text && <span className="text-slate-500">{m.status_text}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <form action={followUpCallAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="outcome" value="no_answer" />
                        <button className="btn btn-sm" title="מתעד שיחה 'אין מענה' ומזיז למחר">א&quot;מ → מחר</button>
                      </form>
                      <form action={followUpCallAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="outcome" value="left_message" />
                        <button className="btn btn-sm" title="מתעד 'השארתי הודעה' ומעביר ל'הם יחזרו אלינו'">השארתי הודעה</button>
                      </form>
                      <Link href={`/meetings/${m.id}`} className="btn btn-sm btn-primary">עדכון</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Daily checklist */}
        <section className="card">
          <h2 className="flex items-center justify-between border-b border-slate-100 px-4 py-3 font-semibold">
            משימות קבועות להיום
            <Link href="/settings#tasks" className="text-xs font-normal text-slate-400 hover:underline">עריכה</Link>
          </h2>
          <ul className="space-y-1 p-3">
            {checklist.map((t) => (
              <li key={t.id}>
                <form action={toggleDailyTaskAction}>
                  <input type="hidden" name="taskId" value={t.id} />
                  <button className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50">
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${t.done_at ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                      {t.done_at && '✓'}
                    </span>
                    <span>
                      <span className={t.done_at ? 'text-slate-400 line-through' : ''}>{t.title}</span>
                      {t.done_at && <span className="block text-[11px] text-slate-400">{t.done_by_name} · {fmtTime(t.done_at.replace(' ', 'T'))}</span>}
                    </span>
                  </button>
                </form>
              </li>
            ))}
            {checklist.length === 0 && <li className="text-sm text-slate-500">אין משימות קבועות להיום</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">פגישות בשבוע הקרוב</h2>
          {meetings.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">אין פגישות קרובות</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="w-28 font-medium text-emerald-700">{fmtDate(m.meeting_date, true)}</span>
                  <span className="w-12">{m.meeting_time}</span>
                  <Link href={`/meetings/${m.id}`} className="link flex-1">{m.contact_name} <span className="text-slate-500">· {m.org_name}</span></Link>
                  <span className="text-slate-500">{m.meeting_place}</span>
                  <form action={toggleMaterialsAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className={`chip cursor-pointer ${m.materials_asked ? 'bg-emerald-50 text-emerald-700 ring-emerald-300' : 'bg-amber-50 text-amber-800 ring-amber-300'}`}>
                      {m.materials_asked ? '✓ נשאל על חומרים' : 'לשאול אם להכין חומרים'}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {deadlines.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-sm">
              <span className="font-medium text-amber-800">⏰ מועדי יעד קרובים: </span>
              {deadlines.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ' · '}
                  <Link href={`/meetings/${m.id}`} className={`link ${m.deadline! < today ? 'text-rose-600' : ''}`}>
                    {m.contact_name} ({fmtDate(m.deadline)})
                  </Link>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-2 font-semibold">שיחות השבוע</h2>
          <div className="text-3xl font-bold text-brand-700">{weekTotal}</div>
          <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
            {weekCounts.map((w) => <li key={w.name}>{w.name}: {w.n}</li>)}
            <li>היום: {todays.total}</li>
          </ul>
        </section>
      </div>

      <details className="card group" open={due.length === 0}>
        <summary className="cursor-pointer px-4 py-3 font-semibold">📞 תיעוד שיחה מהיר</summary>
        <div className="border-t border-slate-100 p-4">
          <CallForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} />
        </div>
      </details>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">השיחות של היום</h2>
        <CallsTable rows={todays.rows} />
      </section>
    </div>
  );
}
