'use client';

import { useActionState } from 'react';
import { loginAction, setupAction } from '../actions/auth';

export function LoginForm({ users }: { users: { id: number; name: string; shift: string }[] }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="label">מי את?</legend>
        <div className="grid grid-cols-2 gap-2">
          {users.map((u) => (
            <label key={u.id} className="btn has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
              <input type="radio" name="userId" value={u.id} className="sr-only" required />
              {u.name}
              <span className="text-xs text-slate-400">{u.shift === 'morning' ? 'בוקר' : 'צהריים'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="password">סיסמה</label>
        <input id="password" name="password" type="password" className="input" required autoFocus />
      </div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? 'נכנסת...' : 'כניסה'}</button>
    </form>
  );
}

export function SetupForm({ needCode }: { needCode: boolean }) {
  const [state, action, pending] = useActionState(setupAction, null);
  return (
    <form action={action} className="space-y-4">
      {needCode && (
        <div>
          <label className="label">קוד התקנה (מההגדרות של השרת)</label>
          <input name="setupCode" className="input" required autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} dir="ltr" />
        </div>
      )}
      <div>
        <label className="label">שם מזכירת הבוקר</label>
        <input name="morning" className="input" defaultValue="זוהי" required />
      </div>
      <div>
        <label className="label">שם מזכירת הצהריים</label>
        <input name="afternoon" className="input" required />
      </div>
      <fieldset>
        <legend className="label">מי את (במחשב הזה)?</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="radio" name="me" value="morning" /> מזכירת הבוקר</label>
          <label className="flex items-center gap-1"><input type="radio" name="me" value="afternoon" defaultChecked /> מזכירת הצהריים</label>
        </div>
      </fieldset>
      <div>
        <label className="label">סיסמה למערכת (משותפת לשתיכן, לפחות 8 תווים)</label>
        <input name="password" type="password" className="input" required minLength={8} />
      </div>
      <div>
        <label className="label">שוב את הסיסמה</label>
        <input name="password2" type="password" className="input" required minLength={8} />
      </div>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>שמירה והתחלה</button>
    </form>
  );
}
