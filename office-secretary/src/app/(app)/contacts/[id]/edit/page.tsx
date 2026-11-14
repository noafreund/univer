import { notFound } from 'next/navigation';
import { ContactForm } from '@/components/contact-form';
import { contactOptions, getContact, listOrgs } from '@/lib/data';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getContact(Number(id));
  if (!c) notFound();
  return (
    <div className="space-y-4">
      <h1 className="page-title">עריכת {c.name}</h1>
      <section className="card p-4">
        <ContactForm
          contacts={contactOptions()}
          orgNames={listOrgs().map((o) => o.name)}
          initial={{
            id: c.id,
            name: c.name,
            role: c.role,
            org: c.org_name ?? '',
            assistantId: c.assistant_id,
            notes: c.notes,
            phones: c.phoneList,
            emails: c.emailList,
          }}
        />
      </section>
    </div>
  );
}
