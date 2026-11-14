import Link from 'next/link';
import { CallForm } from '@/components/call-form';
import { CallsTable } from '@/components/calls-table';
import { RESULTS } from '@/core/constants';
import { contactOptions, listCalls, listOrgs } from '@/core/data';

type SP = Record<string, string | undefined>;

export default async function CallsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const limit = Number(sp.limit) || 100;
  const filters = {
    from: sp.from || undefined,
    to: sp.to || undefined,
    orgId: Number(sp.org) || undefined,
    result: sp.result || undefined,
    open: sp.open === 'open' || sp.open === 'closed' ? sp.open : undefined,
    q: sp.q || undefined,
    limit,
  } as const;
  const { rows, total } = listCalls(filters);
  const orgs = listOrgs();
  const hasFilters = Boolean(sp.from || sp.to || sp.org || sp.result || sp.open || sp.q);
  const moreParams = new URLSearchParams(Object.entries({ ...sp, limit: String(limit + 200) }).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="space-y-4">
      <h1 className="page-title">יומן שיחות</h1>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">תיעוד שיחה חדשה</h2>
        <CallForm contacts={contactOptions()} orgNames={orgs.map((o) => o.name)} />
      </section>

      <section className="card">
        <form className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3 lg:grid-cols-7">
          <input name="q" defaultValue={sp.q} placeholder="חיפוש בפירוט..." className="input lg:col-span-2" />
          <select name="org" defaultValue={sp.org ?? ''} className="input">
            <option value="">כל הארגונים</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select name="result" defaultValue={sp.result ?? ''} className="input">
            <option value="">כל התוצאות</option>
            {Object.entries(RESULTS).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
          <select name="open" defaultValue={sp.open ?? ''} className="input">
            <option value="">פתוח + סגור</option>
            <option value="open">רק פתוחות</option>
            <option value="closed">רק סגורות</option>
          </select>
          <input type="date" name="from" defaultValue={sp.from} className="input" title="מתאריך" />
          <input type="date" name="to" defaultValue={sp.to} className="input" title="עד תאריך" />
          <div className="flex gap-2 lg:col-span-7">
            <button className="btn btn-primary">סינון</button>
            {hasFilters && <Link href="/calls" className="btn">ניקוי</Link>}
            <span className="ms-auto self-center text-sm text-slate-500">
              {total.toLocaleString('he-IL')} שיחות{rows.length < total && ` (מוצגות ${rows.length})`}
            </span>
          </div>
        </form>
        <CallsTable rows={rows} />
        {rows.length < total && (
          <div className="border-t border-slate-100 p-3 text-center">
            <Link href={`/calls?${moreParams}`} className="btn" scroll={false}>הצגת עוד</Link>
          </div>
        )}
      </section>
    </div>
  );
}
