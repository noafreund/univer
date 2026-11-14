import Link from 'next/link';
import { CallsTable } from '@/components/calls-table';
import { listCalls, listContacts, listOrgs } from '@/lib/data';
import { normalizeOrgName } from '@/lib/normalize';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? '';
  if (!q) return <p className="text-slate-500">הקלידי משהו בתיבת החיפוש למעלה.</p>;
  const contacts = listContacts({ q });
  const nq = normalizeOrgName(q);
  const orgs = listOrgs().filter((o) => o.name.includes(q) || (nq && o.norm.includes(nq)) || o.aliases.includes(q));
  const calls = listCalls({ q, limit: 50 });

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
      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">שיחות ({calls.total})</h2>
        <CallsTable rows={calls.rows} />
      </section>
    </div>
  );
}
