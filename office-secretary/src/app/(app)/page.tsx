import Link from 'next/link';
import { CallForm } from '@/components/call-form';
import { CallsTable } from '@/components/calls-table';
import { requireUser } from '@/lib/auth';
import { contactOptions, listCalls, listOrgs } from '@/lib/data';
import { addDays, fmtDate, startOfWeek, todayIso } from '@/lib/dates';

export default async function HomePage() {
  const user = await requireUser();
  const today = todayIso();
  const todays = listCalls({ from: today, to: today, limit: 50 });
  const week = listCalls({ from: startOfWeek(today), to: addDays(startOfWeek(today), 6), limit: 1 });
  const open = listCalls({ open: 'open', limit: 1 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">היום שלי</h1>
        <p className="text-sm text-slate-500">{fmtDate(today, true)} · {user.name}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="שיחות היום" value={todays.total} />
        <Stat label="שיחות השבוע" value={week.total} />
        <Stat label="שיחות פתוחות" value={open.total} href="/calls?open=open" />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">תיעוד שיחה מהיר</h2>
        <CallForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} />
      </section>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">השיחות של היום</h2>
        <CallsTable rows={todays.rows} />
      </section>

      <p className="text-center text-xs text-slate-400">
        בשלב הבא יופיעו כאן: למי להתקשר היום, פגישות השבוע, משימות קבועות והעברת משמרת.
      </p>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="card p-3 text-center">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
