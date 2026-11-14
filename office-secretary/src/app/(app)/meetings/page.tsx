import Link from 'next/link';
import { StateChip } from '@/components/badges';
import { Kanban } from '@/components/kanban';
import { MEETING_STATES } from '@/core/constants';
import { listMeetings, listOrgs } from '@/core/data';
import { fmtDate, todayIso } from '@/core/dates';

type SP = { view?: string; state?: string; q?: string; org?: string; highlight?: string };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === 'kanban' ? 'kanban' : 'table';
  const today = todayIso();
  const meetings = listMeetings({ state: view === 'table' ? sp.state : undefined, q: sp.q, orgId: Number(sp.org) || undefined });
  const orgs = listOrgs();
  const tab = (v: string) => `/meetings?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), view: v })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">מעקב פגישות</h1>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <Link href={tab('table')} className={`rounded-md px-3 py-1 ${view === 'table' ? 'bg-brand-600 text-white' : ''}`}>טבלה</Link>
            <Link href={tab('kanban')} className={`rounded-md px-3 py-1 ${view === 'kanban' ? 'bg-brand-600 text-white' : ''}`}>קנבן</Link>
          </div>
          <Link href="/meetings/new" className="btn btn-primary">+ יעד חדש</Link>
        </div>
      </div>

      <form className="card flex flex-wrap gap-2 p-3">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="שם, ארגון, נושא, סטטוס..." className="input flex-1" />
        <select name="org" defaultValue={sp.org ?? ''} className="input w-auto">
          <option value="">כל הארגונים</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {view === 'table' && (
          <select name="state" defaultValue={sp.state ?? ''} className="input w-auto">
            <option value="">כל המצבים</option>
            {Object.entries(MEETING_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        <button className="btn">סינון</button>
      </form>

      {view === 'kanban' ? (
        <Kanban meetings={meetings} today={today} />
      ) : (
        <div className="card overflow-x-auto">
          {meetings.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">אין יעדים עדיין. לחצי &quot;+ יעד חדש&quot;.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>איש קשר</th><th>ארגון</th><th>נושא</th><th>מצב</th><th>מעקב הבא</th><th>פנייה אחרונה</th><th>מועד יעד</th><th>סטטוס</th></tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const overdue = m.next_follow_up && m.next_follow_up < today;
                  return (
                    <tr key={m.id} className={String(m.id) === sp.highlight ? 'bg-brand-50' : 'hover:bg-slate-50/60'}>
                      <td className="whitespace-nowrap">
                        <Link href={`/meetings/${m.id}`} className="link font-medium">{m.contact_name}</Link>
                        <div className="text-xs text-slate-500">{m.contact_role}</div>
                      </td>
                      <td className="text-slate-600">{m.org_name}</td>
                      <td className="text-slate-600">{m.subject}</td>
                      <td><StateChip state={m.state} /></td>
                      <td className={`whitespace-nowrap ${overdue ? 'font-bold text-rose-600' : ''}`}>
                        {m.state === 'meeting_set' ? (
                          <span className="text-emerald-700">📅 {fmtDate(m.meeting_date)} {m.meeting_time}</span>
                        ) : (
                          fmtDate(m.next_follow_up)
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{fmtDate(m.last_contact)}</td>
                      <td className="whitespace-nowrap text-amber-700" title={m.deadline_note}>{fmtDate(m.deadline)}</td>
                      <td className="text-slate-600">{m.status_text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
