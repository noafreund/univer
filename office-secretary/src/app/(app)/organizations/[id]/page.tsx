import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteOrgAction, mergeOrgsAction, saveOrgAction } from '@/app/actions/contacts';
import { CallsTable } from '@/components/calls-table';
import { ConfirmButton } from '@/components/confirm-button';
import { ORG_TYPES } from '@/lib/constants';
import { getOrg, listCalls, listContacts, listOrgs } from '@/lib/data';

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = getOrg(Number(id));
  if (!org) notFound();
  const contacts = listContacts({ orgId: org.id });
  const calls = listCalls({ orgId: org.id, limit: 50 });
  const others = listOrgs().filter((o) => o.id !== org.id);

  return (
    <div className="space-y-4">
      <Link href="/organizations" className="link text-sm">→ ארגונים</Link>
      <h1 className="page-title">{org.name}</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={saveOrgAction} className="card space-y-3 p-4">
          <input type="hidden" name="id" value={org.id} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">שם</label>
              <input name="name" className="input" defaultValue={org.name} required />
            </div>
            <div>
              <label className="label">סוג</label>
              <select name="type" className="input" defaultValue={org.type}>
                {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">שמות נוספים (שורה לכל שם) – עוזר לזהות כפילויות</label>
            <textarea name="aliases" rows={2} className="input" defaultValue={org.aliases} />
          </div>
          <div>
            <label className="label">הערות</label>
            <textarea name="notes" rows={2} className="input" defaultValue={org.notes} />
          </div>
          <button className="btn btn-primary">שמירה</button>
        </form>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">אנשי קשר ({contacts.length})</h2>
            <Link href={`/contacts/new?org=${org.id}`} className="btn btn-sm">+ איש קשר</Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex justify-between py-1.5">
                <Link href={`/contacts/${c.id}`} className="link">{c.name}</Link>
                <span className="text-slate-500">{c.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">שיחות אחרונות ({calls.total})</h2>
        <CallsTable rows={calls.rows} />
      </section>

      <section className="card flex flex-wrap items-end gap-2 p-4 text-sm">
        <form action={mergeOrgsAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="sourceId" value={org.id} />
          <div>
            <label className="label">לאחד את הארגון הזה לתוך:</label>
            <select name="targetId" className="input" required defaultValue="">
              <option value="" disabled>בחירת ארגון...</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <ConfirmButton message="כל אנשי הקשר והשיחות יעברו לארגון שנבחר, והארגון הזה יימחק. להמשיך?" className="btn">איחוד</ConfirmButton>
        </form>
        <form action={deleteOrgAction} className="ms-auto">
          <input type="hidden" name="id" value={org.id} />
          <ConfirmButton message="למחוק את הארגון? (אנשי הקשר יישארו, בלי ארגון)" className="btn btn-danger">מחיקת ארגון</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
