import { ExportButton } from '@/components/export-button';
import Link from 'next/link';
import { listContacts, listOrgs } from '@/core/data';
import { fmtDate } from '@/core/dates';

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; org?: string }> }) {
  const sp = await searchParams;
  const contacts = listContacts({ q: sp.q, orgId: Number(sp.org) || undefined });
  const orgs = listOrgs();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">אנשי קשר</h1>
        <div className="flex gap-2"><ExportButton table="contacts" /><Link href="/contacts/new" className="btn btn-primary">+ איש קשר חדש</Link></div>
      </div>
      <form className="card flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={sp.q} placeholder="שם, תפקיד, טלפון, מייל..." className="input flex-1" />
        <select name="org" defaultValue={sp.org ?? ''} className="input w-auto">
          <option value="">כל הארגונים</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button className="btn">חיפוש</button>
      </form>
      <div className="card overflow-x-auto">
        {contacts.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">אין אנשי קשר עדיין</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>שם</th><th>תפקיד</th><th>ארגון</th><th>טלפון</th><th>שיחה אחרונה</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td><Link href={`/contacts/${c.id}`} className="link font-medium">{c.name}</Link></td>
                  <td className="text-slate-600">{c.role}</td>
                  <td className="text-slate-600">{c.org_name}</td>
                  <td dir="ltr" className="text-end whitespace-nowrap text-slate-600">{c.phones?.split(' | ')[0]}</td>
                  <td className="whitespace-nowrap text-slate-500">
                    {c.last_call ? `${fmtDate(c.last_call)} (${c.calls_count})` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
