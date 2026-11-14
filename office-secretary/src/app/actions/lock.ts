'use server';

import { redirect } from 'next/navigation';
import { currentUser } from '@/core/auth';
import { releaseLock, takeLock } from '@/core/lock';

export async function takeLockAction() {
  const u = await currentUser();
  if (!u) redirect('/login');
  takeLock(u.name);
  redirect('/');
}

export async function releaseLockAction() {
  releaseLock();
  redirect('/released');
}
