import { ExportButton } from '@/components/export-button';
import Link from 'next/link';
import { mergeOrgsAction, saveOrgAction } from '@/app/actions/contacts';
import { ORG_TYPES, type OrgType } from '@/core/constants';
import { listOrgs } from '@/core/data';

export default async function OrganizationsPage() {
  const orgs = listOrgs();

  // Suggest merges: organizations whose names look alike (one contains the other after normalizing).
  const suggestions: [typeof orgs[number], typeof orgs[number]][] = [];
  for (let i = 0; i < orgs.length; i++)
    for (let j = i + 1; j < orgs.length; j++) {
      const a = orgs[i].norm, b = orgs[j].norm;
      if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) suggestions.push([orgs[i], orgs[j]]);
    }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="page-title">ארגונים</h1><ExportButton table="organizations" /></div>

      <form action={saveOrgAction} className="card flex flex-wrap items-end gap-2 p-3">
        <div className="flex-1">
          <label className="label">ארגון חדש</label>
          <input name="name" className="input" placeholder='למשל: מ.א. עמק חפר' required />
        </div>
        <select name="type" className="input w-auto">
          {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-primary">הוספה</button>
      </form>

      {suggestions.length > 0 && (
        <section className="card border-amber-300 p-3">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">⚠️ נראה שיש ארגונים כפולים</h2>
          <ul className="space-y-2 text-sm">
            {suggestions.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`} className="flex flex-wrap items-center gap-2">
                <span>&quot;{a.name}&quot; ו-&quot;{b.name}&quot;</span>
                <form action={mergeOrgsAction}>
                  <input type="hidden" name="sourceId" value={b.id} />
                  <input type="hidden" name="targetId" value={a.id} />
                  <button className="btn btn-sm">לאחד ל-&quot;{a.name}&quot;</button>
                </form>
                <form action={mergeOrgsAction}>
                  <input type="hidden" name="sourceId" value={a.id} />
                  <input type="hidden" name="targetId" value={b.id} />
                  <button className="btn btn-sm">לאחד ל-&quot;{b.name}&quot;</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card overflow-x-auto">
        {orgs.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">אין ארגונים עדיין</p>
        ) : (
          <table className="table">
            <thead><tr><th>שם</th><th>סוג</th><th>אנשי קשר</th><th>שיחות</th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/organizations/${o.id}`} className="link font-medium">{o.name}</Link>
                    {o.aliases && <div className="text-xs text-slate-400">גם: {o.aliases.split('\n').join(', ')}</div>}
                  </td>
                  <td className="text-slate-600">{ORG_TYPES[o.type as OrgType] ?? o.type}</td>
                  <td>{o.contacts}</td>
                  <td>{o.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
