import { ContactForm } from '@/components/contact-form';
import { contactOptions, listOrgs, getOrg } from '@/core/data';

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams;
  const org = sp.org ? getOrg(Number(sp.org))?.name : undefined;
  return (
    <div className="space-y-4">
      <h1 className="page-title">איש קשר חדש</h1>
      <section className="card p-4">
        <ContactForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} initial={{ org }} />
      </section>
    </div>
  );
}
