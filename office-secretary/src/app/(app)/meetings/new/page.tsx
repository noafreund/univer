import { MeetingForm } from '@/components/meeting-form';
import { contactOptions, listOrgs } from '@/core/data';

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const sp = await searchParams;
  const contactId = Number(sp.contact) || undefined;
  return (
    <div className="space-y-4">
      <h1 className="page-title">יעד חדש לקביעת פגישה</h1>
      <section className="card p-4">
        <MeetingForm
          contacts={contactOptions()}
          orgNames={listOrgs().map((o) => o.name)}
          fixedContactId={contactId}
          returnTo={contactId ? `/contacts/${contactId}` : undefined}
        />
      </section>
    </div>
  );
}
