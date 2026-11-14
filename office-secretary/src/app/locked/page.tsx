import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/core/auth';
import { lockStatus } from '@/core/lock';
import { takeLockAction } from '../actions/lock';
import { ConfirmButton } from '@/components/confirm-button';

export const dynamic = 'force-dynamic';

export default async function LockedPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const s = lockStatus();
  if (s.free) redirect('/');
  const minutes = Math.max(0, Math.round((Date.now() - s.holder.at) / 60_000));
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-xl font-bold">המערכת פתוחה כרגע אצל {s.holder.user}</h1>
        <p className="text-sm text-slate-600">
          במחשב <span dir="ltr">{s.holder.host}</span> · פעילות אחרונה {minutes === 0 ? 'עכשיו' : `לפני ${minutes} דק׳`}
        </p>
        <p className="text-sm text-slate-500">
          כדי לשמור על המידע, רק מחשב אחד עובד במערכת בכל רגע. כשהיא תסגור את המערכת (או אחרי 3 דקות בלי פעילות) – אפשר להיכנס.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/" className="btn">לנסות שוב</Link>
          <form action={takeLockAction}>
            <ConfirmButton
              className="btn btn-primary w-full"
              message={`לקחת את המערכת? המסך של ${s.holder.user} יעבור למצב המתנה (מה שכבר נשמר לא ייפגע).`}
            >
              לקחת את המערכת אליי
            </ConfirmButton>
          </form>
        </div>
      </div>
    </main>
  );
}
