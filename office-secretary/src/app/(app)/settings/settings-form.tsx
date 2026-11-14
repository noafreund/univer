'use client';

import { useActionState } from 'react';
import { updateSettingsAction } from '@/app/actions/auth';

export function SettingsForm({ morning, afternoon }: { morning: string; afternoon: string }) {
  const [state, action, pending] = useActionState(updateSettingsAction, null);
  return (
    <form action={action} className="max-w-md space-y-3">
      <h2 className="font-semibold">שמות המזכירות</h2>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">בוקר</label>
          <input name="morning" className="input" defaultValue={morning} required />
        </div>
        <div>
          <label className="label">צהריים</label>
          <input name="afternoon" className="input" defaultValue={afternoon} required />
        </div>
      </div>
      <h2 className="pt-2 font-semibold">שינוי סיסמה (לא חובה)</h2>
      <input name="oldPassword" type="password" className="input" placeholder="סיסמה נוכחית" autoComplete="current-password" />
      <input name="newPassword" type="password" className="input" placeholder="סיסמה חדשה" autoComplete="new-password" />
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">✓ {state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>שמירה</button>
    </form>
  );
}
