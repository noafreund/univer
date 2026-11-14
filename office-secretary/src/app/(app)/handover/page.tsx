import { HandoverCard, HandoverItemRow, type Summary } from '@/components/handover-card';
import { HandoverForm, type Suggestion } from '@/components/handover-form';
import { requireUser } from '@/core/auth';
import { contactOptions, listHandovers, listUsers, openHandoverItemsFor, pendingHandoversFor, shiftSummary } from '@/core/data';
import { fmtDate, todayIso } from '@/core/dates';

export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ q?: string; sent?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const other = listUsers().find((u) => u.id !== me.id);
  const today = todayIso();
  const pending = pendingHandoversFor(me.id);
  const carried = openHandoverItemsFor(me.id);
  const s = shiftSummary(me.id, today);
  const summary: Summary = {
    calls: s.calls,
    openCalls: s.openCalls.length,
    meetingsSet: s.meetingsSet.length,
    dueNotHandled: s.dueNotHandled.length,
    tasksLeft: s.tasksLeft.map((t) => t.title),
  };
  const suggestions: Suggestion[] = [
    ...s.openCalls.map((c) => ({
      kind: 'שיחה פתוחה',
      text: `${c.contact_name ?? c.spoke_with}${c.org_name ? ` (${c.org_name})` : ''}${c.details ? ` – ${c.details}` : ''}`,
      contactId: c.contact_id,
    })),
    ...s.dueNotHandled.map((m) => ({
      kind: 'להתקשר',
      text: `${m.contact_name}${m.org_name ? ` (${m.org_name})` : ''} – ${m.subject}${m.status_text ? ` · ${m.status_text}` : ''}`,
      contactId: m.contact_id,
    })),
    ...s.tasksLeft.map((t) => ({ kind: 'משימה קבועה', text: t.title, contactId: null })),
  ];
  const history = listHandovers({ q: sp.q });

  return (
    <div className="space-y-6">
      <h1 className="page-title">העברת משמרת</h1>
      {sp.sent && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ ההעברה נשלחה ל{other?.name}</p>}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-brand-700">📬 העברה חדשה בשבילך</h2>
          {pending.map((h) => <HandoverCard key={h.id} h={h} meId={me.id} highlight />)}
        </section>
      )}

      {carried.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">משימות שהועברו אלייך ועוד לא בוצעו</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {carried.map((i) => (
              <HandoverItemRow key={i.id} item={i} canAct sub={`מ${i.from_name}, ${fmtDate(i.created_at)}`} />
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">העברת משמרת ל{other?.name}</h2>
        <p className="mb-3 text-sm text-slate-500">
          היום תיעדת {summary.calls} שיחות ({summary.openCalls} פתוחות) · {summary.meetingsSet} פגישות נקבעו ·{' '}
          {summary.dueNotHandled} מעקבים להיום שעוד לא טופלו
        </p>
        <HandoverForm contacts={contactOptions()} suggestions={suggestions} summary={JSON.stringify(summary)} otherName={other?.name ?? ''} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">היסטוריה</h2>
          <form className="flex gap-2">
            <input name="q" defaultValue={sp.q} placeholder="חיפוש בהעברות קודמות..." className="input" />
            <button className="btn">חיפוש</button>
          </form>
        </div>
        {history.length === 0 && <p className="text-sm text-slate-500">אין עדיין העברות.</p>}
        {history.filter((h) => !pending.some((p) => p.id === h.id)).map((h) => <HandoverCard key={h.id} h={h} meId={me.id} />)}
      </section>
    </div>
  );
}
