import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteMeetingAction } from '@/app/actions/meetings';
import { CallsTable } from '@/components/calls-table';
import { ConfirmButton } from '@/components/confirm-button';
import { MeetingForm } from '@/components/meeting-form';
import { contactOptions, getMeeting, listCalls, listOrgs } from '@/core/data';

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ state?: string }> }) {
  const { id } = await params;
  const { state } = await searchParams;
  const m = getMeeting(Number(id));
  if (!m) notFound();
  const calls = m.contact_id ? listCalls({ contactId: m.contact_id, limit: 20 }) : null;
  return (
    <div className="space-y-4">
      <Link href="/meetings" className="link text-sm">→ מעקב פגישות</Link>
      <div className="flex items-center justify-between">
        <h1 className="page-title">
          פגישה עם {m.contact_id ? <Link href={`/contacts/${m.contact_id}`} className="link">{m.contact_name}</Link> : '—'}
          <span className="ms-2 text-base font-normal text-slate-500">{m.org_name}</span>
        </h1>
        <form action={deleteMeetingAction}>
          <input type="hidden" name="id" value={m.id} />
          <ConfirmButton message="למחוק את היעד? (השיחות ביומן לא יימחקו)" className="btn btn-danger btn-sm">מחיקה</ConfirmButton>
        </form>
      </div>
      <section className="card p-4">
        <MeetingForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} meeting={m} initialState={state} />
      </section>
      {calls && (
        <section className="card">
          <h2 className="border-b border-slate-100 px-4 py-3 font-semibold">שיחות אחרונות עם {m.contact_name}</h2>
          <CallsTable rows={calls.rows} hideContact />
        </section>
      )}
    </div>
  );
}
