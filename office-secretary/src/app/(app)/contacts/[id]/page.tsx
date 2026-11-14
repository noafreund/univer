import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteContactAction } from '@/app/actions/contacts';
import { quickNoAnswerAction } from '@/app/actions/calls';
import { CallForm } from '@/components/call-form';
import { CallsTable } from '@/components/calls-table';
import { ConfirmButton } from '@/components/confirm-button';
import { contactOptions, getContact, listCalls, listOrgs } from '@/lib/data';
import { fmtDate } from '@/lib/dates';
import { formatPhone, phoneDigits } from '@/lib/normalize';

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getContact(Number(id));
  if (!c) notFound();
  const calls = listCalls({ contactId: c.id, limit: 500 });

  return (
    <div className="space-y-4">
      <Link href="/contacts" className="link text-sm">→ אנשי קשר</Link>
      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <p className="text-slate-600">
              {c.role}
              {c.org_name && (
                <>
                  {c.role && ' · '}
                  <Link href={`/organizations/${c.organization_id}`} className="link">{c.org_name}</Link>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={quickNoAnswerAction}>
              <input type="hidden" name="contactId" value={c.id} />
              <button className="btn font-bold">📵 א&quot;מ עכשיו</button>
            </form>
            <Link href={`/contacts/${c.id}/edit`} className="btn">עריכה</Link>
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton message={`למחוק את ${c.name}? (השיחות שלו יישארו ביומן)`} className="btn btn-danger">מחיקה</ConfirmButton>
            </form>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            {c.phoneList.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-16 text-xs text-slate-500">{p.label || 'טלפון'}</span>
                <a href={`tel:${phoneDigits(p.number)}`} className="link" dir="ltr">{formatPhone(p.number)}</a>
              </div>
            ))}
            {c.emailList.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="w-16 text-xs text-slate-500">{e.label || 'מייל'}</span>
                <a href={`mailto:${e.email}`} className="link" dir="ltr">{e.email}</a>
              </div>
            ))}
            {!c.phoneList.length && !c.emailList.length && <p className="text-sm text-slate-400">אין טלפון או מייל</p>}
          </div>
          <div className="space-y-2 text-sm">
            {c.assistant_id && (
              <p>
                <span className="text-slate-500">המזכירה / מנהלת הלשכה: </span>
                <Link href={`/contacts/${c.assistant_id}`} className="link font-medium">{c.assistant_name}</Link>
              </p>
            )}
            {c.assistantOf.length > 0 && (
              <p>
                <span className="text-slate-500">מזכירה / מנהלת לשכה של: </span>
                {c.assistantOf.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ', '}
                    <Link href={`/contacts/${a.id}`} className="link font-medium">{a.name}</Link>
                    {a.role && <span className="text-slate-500"> ({a.role})</span>}
                  </span>
                ))}
              </p>
            )}
            {c.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{c.notes}</p>}
            <p className="text-slate-500">
              {calls.total} שיחות{c.last_call && ` · אחרונה ${fmtDate(c.last_call)}`}
            </p>
            <p className="text-xs text-slate-400">מעקב הפגישה מול איש הקשר יופיע כאן בשלב הבא.</p>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">תיעוד שיחה עם {c.name}</h2>
        <CallForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} fixedContactId={c.id} />
      </section>

      <section className="card">
        <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">היסטוריית שיחות</h2>
        <CallsTable rows={calls.rows} hideContact />
      </section>
    </div>
  );
}
