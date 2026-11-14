import { redirect } from 'next/navigation';
import { currentUser, isSetUp } from '@/core/auth';
import { dataDirAvailable } from '@/core/db';
import { listUsers } from '@/core/data';
import { LoginForm, SetupForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!dataDirAvailable()) redirect('/no-drive');
  if (await currentUser()) redirect('/');
  const setUp = isSetUp();
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="mb-1 text-2xl font-bold text-brand-700">המשרד</h1>
        <p className="mb-6 text-sm text-slate-500">{setUp ? 'כניסה למערכת' : 'הגדרה ראשונה של המערכת'}</p>
        {setUp ? <LoginForm users={listUsers()} /> : <SetupForm />}
      </div>
    </main>
  );
}
