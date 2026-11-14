'use client';

import { useActionState } from 'react';
import { restoreBackupAction } from '@/app/actions/stage3';

export function RestoreForm() {
  const [state, action, pending] = useActionState(restoreBackupAction, null);
  return (
    <form action={action} className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
      <p className="text-sm font-medium text-rose-800">שחזור מגיבוי – מחליף את כל המידע הנוכחי במידע מהקובץ</p>
      <input type="file" name="file" className="block text-sm" required />
      <input name="confirm" className="input max-w-xs" placeholder='להקליד "שחזור" לאישור' autoComplete="off" />
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">✓ {state.message}</p>}
      <button className="btn btn-danger" disabled={pending}>{pending ? 'משחזרת...' : 'שחזור'}</button>
    </form>
  );
}
