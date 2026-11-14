import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteAppealAction } from '@/app/actions/stage3';
import { AppealForm } from '@/components/appeal-form';
import { ConfirmButton } from '@/components/confirm-button';
import { getAppeal } from '@/core/data';
import { fmtDate } from '@/core/dates';

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const s = getAppeal(Number((await params).id));
  if (!s) notFound();
  return (
    <div className="space-y-4">
      <Link href="/appeals" className="link text-sm">→ ועדת השגות</Link>
      <div className="flex items-center justify-between">
        <h1 className="page-title">ישיבה {fmtDate(s.session_date, true)}</h1>
        <form action={deleteAppealAction}>
          <input type="hidden" name="id" value={s.id} />
          <ConfirmButton message="למחוק את הישיבה (כולל הקבצים המצורפים)?" className="btn btn-sm btn-danger">מחיקה</ConfirmButton>
        </form>
      </div>
      <section className="card p-4"><AppealForm s={s} /></section>
    </div>
  );
}
