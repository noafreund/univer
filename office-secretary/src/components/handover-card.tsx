import Link from 'next/link';
import { acknowledgeHandoverAction, setHandoverItemAction } from '@/app/actions/handover';
import type { Handover, HandoverItem } from '@/core/data';
import { fmtDate, fmtTime } from '@/core/dates';

export type Summary = { calls: number; openCalls: number; meetingsSet: number; dueNotHandled: number; tasksLeft: string[] };

export function parseSummary(s: string): Summary | null {
  try {
    return JSON.parse(s) as Summary;
  } catch {
    return null;
  }
}

const STATUS = {
  pending: { label: 'ממתין', cls: 'bg-slate-100 text-slate-600 ring-slate-300' },
  received: { label: 'קיבלתי', cls: 'bg-sky-50 text-sky-700 ring-sky-300' },
  done: { label: 'בוצע ✓', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-300' },
};

export function HandoverItemRow({ item, canAct, sub }: { item: HandoverItem; canAct: boolean; sub?: string }) {
  return (
    <li className={`flex flex-wrap items-center gap-2 py-2 ${item.status === 'done' ? 'opacity-60' : ''}`}>
      {item.urgent === 1 && <span className="chip bg-rose-100 text-rose-700 ring-rose-300">דחוף</span>}
      <span className={`flex-1 ${item.status === 'done' ? 'line-through' : ''}`}>
        {item.text}
        {item.contact_id && (
          <>
            {' '}· <Link href={`/contacts/${item.contact_id}`} className="link">{item.contact_name}</Link>
          </>
        )}
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </span>
      <span className={`chip ${STATUS[item.status].cls}`}>{STATUS[item.status].label}</span>
      {canAct && item.status !== 'done' && (
        <form action={setHandoverItemAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="status" value="done" />
          <button className="btn btn-sm">סימון בוצע</button>
        </form>
      )}
      {canAct && item.status === 'done' && (
        <form action={setHandoverItemAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="status" value="received" />
          <button className="btn btn-sm">ביטול</button>
        </form>
      )}
    </li>
  );
}

export function HandoverCard({ h, meId, highlight }: { h: Handover; meId: number; highlight?: boolean }) {
  const forMe = h.to_user === meId;
  const s = parseSummary(h.summary);
  return (
    <article className={`card p-4 ${highlight ? 'border-2 border-brand-500' : ''}`}>
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          {h.from_name} ← {h.to_name}
          <span className="ms-2 text-sm font-normal text-slate-500">{fmtDate(h.created_at, true)} · {fmtTime(h.created_at)}</span>
        </h3>
        {h.acknowledged_at ? (
          <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-300">
            ✓ {h.to_name} קראה ({fmtDate(h.acknowledged_at)} {fmtTime(h.acknowledged_at)})
          </span>
        ) : (
          <span className="chip bg-amber-50 text-amber-800 ring-amber-300">עוד לא נקרא</span>
        )}
      </header>
      {s && (
        <p className="mb-2 text-xs text-slate-500">
          במשמרת: {s.calls} שיחות ({s.openCalls} פתוחות) · {s.meetingsSet} פגישות נקבעו · {s.dueNotHandled} מעקבים שלא טופלו
          {s.tasksLeft.length > 0 && ` · משימות קבועות שלא בוצעו: ${s.tasksLeft.join(', ')}`}
        </p>
      )}
      {h.items.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {h.items.map((i) => <HandoverItemRow key={i.id} item={i} canAct={forMe} />)}
        </ul>
      )}
      {h.notes && <p className="mt-2 rounded-lg bg-amber-50/60 p-3 text-sm whitespace-pre-wrap">{h.notes}</p>}
      {forMe && !h.acknowledged_at && (
        <form action={acknowledgeHandoverAction} className="mt-3">
          <input type="hidden" name="id" value={h.id} />
          <button className="btn btn-primary">קראתי, קיבלתי את המשמרת ✓</button>
        </form>
      )}
    </article>
  );
}
