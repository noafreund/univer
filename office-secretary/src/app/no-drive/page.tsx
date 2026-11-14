import Link from 'next/link';
import { DATA_DIR, dataDirAvailable } from '@/core/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NoDrivePage() {
  if (dataDirAvailable()) redirect('/');
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-4 p-6 text-center">
        <div className="text-4xl">🔌</div>
        <h1 className="text-xl font-bold">אין חיבור לכונן המשותף</h1>
        <p className="text-sm text-slate-600">המערכת לא מצליחה להגיע לתיקיית המידע:</p>
        <p dir="ltr" className="rounded bg-slate-100 p-2 font-mono text-xs">{DATA_DIR}</p>
        <p className="text-sm text-slate-500">בדקי שהמחשב מחובר לרשת של המשרד ושהכונן מופיע ב&quot;מחשב זה&quot;, ואז נסי שוב.</p>
        <Link href="/" className="btn btn-primary">לנסות שוב</Link>
      </div>
    </main>
  );
}
