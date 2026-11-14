import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CallForm } from '@/components/call-form';
import { contactOptions, getCall, listOrgs } from '@/lib/data';

export default async function EditCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = getCall(Number(id));
  if (!call) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/calls" className="link text-sm">→ יומן שיחות</Link>
      </div>
      <h1 className="page-title">עריכת שיחה</h1>
      <section className="card p-4">
        <CallForm contacts={contactOptions()} orgNames={listOrgs().map((o) => o.name)} call={call} />
      </section>
    </div>
  );
}
