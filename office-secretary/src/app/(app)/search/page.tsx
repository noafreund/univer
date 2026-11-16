import Link from 'next/link';
import { CallsTable } from '@/components/calls-table';
import { listCalls, listContacts, listDocLinks, listMeetings, listOrgs, listProcedures, listPublications, listUsefulPhones, searchTasks } from '@/core/data';
import { StateChip } from '@/components/badges';
import { formatPhone, phoneDigits } from '@/core/normalize';
import { normalizeOrgName } from '@/core/normalize';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? '';
  if (!q) return <p className="text-slate-500">הקלידי משהו בתיבת החיפוש למעלה.</p>;
  const contacts = listContacts({ q });
  const nq = normalizeOrgName(q);
  const orgs = listOrgs().filter((o) => o.name.includes(q) || (nq && o.norm.includes(nq)) || o.aliases.includes(q));
  const calls = listCalls({ q, limit: 50 });
  const meetings = listMeetings({ q });
  const procedures = listProcedures(q);
  const phones = listUsefulPhones(q);
  const docs = listDocLinks(q);
  const pubs = listPublications().filter((p) => `${p.source} ${p.name} ${p.note}`.includes(q));
  const tasks = searchTasks(q);
  const extras = tasks.length + procedures.length + phones.length + docs.length + pubs.length;

  return (
    <div className="space-y-4">
      <h1 className="page-title">תוצאות עבור &quot;{q}&quot;</h1>
      {orgs.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">ארגונים</h2>
          <div className="flex flex-wrap gap-2">
            {orgs.map((o) => <Link key={o.id} href={`/organizations/${o.id}`} className="btn btn-sm">{o.name}</Link>)}
          </div>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-2 font-semibold">אנשי קשר ({contacts.length})</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-500">לא נמצאו</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <Link href={`/contacts/${c.id}`} className="link font-medium">{c.name}</Link>
                <span className="text-slate-500">{[c.role, c.org_name].filter(Boolean).join(' · ')}</span>
                <span dir="ltr" className="text-slate-500">{c.phones}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {meetings.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">מעקב פגישות ({meetings.length})</h2>
          <ul className="space-y-1 text-sm">
            {meetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/meetings/${m.id}`} className="link font-medium">{m.contact_name}</Link>
                <span className="text-slate-500">{m.org_name}</span>
                <StateChip state={m.state} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {extras > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">שליפים ופרסומים ({extras})</h2>
          <ul className="space-y-1 text-sm">
            {tasks.map((t) => <li key={`k${t.id}`}>✅ <Link href={`/tasks?edit=${t.id}#form`} className={`link ${t.done ? 'line-through' : ''}`}>{t.title}</Link></li>)}
            {procedures.map((p) => <li key={`p${p.id}`}>📘 <Link href={`/notes?tab=procedures&q=${encodeURIComponent(q)}`} className="link">{p.title}</Link></li>)}
            {phones.map((p) => (
              <li key={`t${p.id}`}>☎️ {p.name} – <a href={`tel:${phoneDigits(p.number)}`} className="link" dir="ltr">{formatPhone(p.number)}</a> <span className="text-slate-500">{p.note}</span></li>
            ))}
            {docs.map((d) => <li key={`d${d.id}`}>📎 <Link href={`/notes?tab=docs&q=${encodeURIComponent(q)}`} className="link">{d.title}</Link></li>)}
            {pubs.map((p) => <li key={`u${p.id}`}>📰 <Link href="/publications" className="link">{p.source} – {p.name}</Link></li>)}
          </ul>
        </section>
      )}
      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">שיחות ({calls.total})</h2>
        <CallsTable rows={calls.rows} />
      </section>
    </div>
  );
}
