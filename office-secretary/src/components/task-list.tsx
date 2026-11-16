import Link from 'next/link';
import { saveTaskAction, toggleTaskAction } from '@/app/actions/tasks';
import type { Task } from '@/core/data';
import { daysBetween, fmtDate, fmtTime } from '@/core/dates';

export function TaskRow({ t, today, showEdit = true }: { t: Task; today: string; showEdit?: boolean }) {
  const late = t.due_date && !t.done ? daysBetween(t.due_date, today) : 0;
  return (
    <li className={`flex items-start gap-2 px-3 py-2 ${t.urgent && !t.done ? 'bg-rose-50/60' : ''}`}>
      <form action={toggleTaskAction}>
        <input type="hidden" name="id" value={t.id} />
        <button
          title={t.done ? 'ביטול סימון' : 'סימון בוצע'}
          className={`mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border ${t.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-400 bg-white'}`}
        >
          {t.done ? '✓' : ''}
        </button>
      </form>
      <div className="min-w-0 flex-1 text-sm">
        <span className={t.done ? 'text-slate-400 line-through' : 'font-medium'}>{t.title}</span>
        <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
          {t.urgent === 1 && !t.done && <span className="font-bold text-rose-600">דחוף</span>}
          {t.requested_by && <span>ביקש/ה: {t.requested_by}</span>}
          {t.due_date && (
            <span className={late > 0 ? 'font-bold text-rose-600' : late === 0 && !t.done ? 'font-semibold text-amber-700' : ''}>
              {late > 0 ? `באיחור ${late} ימים (${fmtDate(t.due_date)})` : late === 0 && !t.done ? 'להיום' : `עד ${fmtDate(t.due_date, true)}`}
            </span>
          )}
          <span>{t.assignee_name ? `ל${t.assignee_name}` : 'לשתינו'}</span>
          {t.contact_id && <Link href={`/contacts/${t.contact_id}`} className="link">{t.contact_name}</Link>}
          {t.done && t.done_at ? <span>בוצע ע״י {t.done_by_name} · {fmtDate(t.done_at)} {fmtTime(t.done_at.replace(' ', 'T'))}</span> : null}
        </div>
        {t.notes && <p className="mt-0.5 text-xs whitespace-pre-wrap text-slate-600">{t.notes}</p>}
      </div>
      {showEdit && <Link href={`/tasks?edit=${t.id}#form`} className="text-xs text-slate-400 hover:text-slate-700">עריכה</Link>}
    </li>
  );
}

/** One-line add form (title + who asked + due date + urgent). Defaults to "assigned to me". */
export function QuickTaskForm({ requesters, returnTo }: { requesters: string[]; returnTo?: string }) {
  return (
    <form action={saveTaskAction} className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
      <input type="hidden" name="assignee" value="me" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input name="title" className="input min-w-48 flex-[3]" placeholder="משימה חדשה... (למשל: לשלוח מכתב לרמ״י)" required />
      <input name="requestedBy" className="input w-28 flex-1" placeholder="מי ביקש" list="requesters" />
      <input type="date" name="due" className="input w-auto" title="עד מתי (לא חובה)" />
      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" name="urgent" value="1" className="size-4" /> דחוף
      </label>
      <button className="btn btn-primary">הוספה</button>
      <datalist id="requesters">{requesters.map((r) => <option key={r} value={r} />)}</datalist>
    </form>
  );
}
