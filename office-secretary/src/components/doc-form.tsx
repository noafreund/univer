'use client';

import { useActionState } from 'react';
import { saveDocAction } from '@/app/actions/stage3';
import type { DocLink } from '@/core/data';

export function DocForm({ d }: { d?: DocLink }) {
  const [state, action, pending] = useActionState(saveDocAction, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      {d && <input type="hidden" name="id" value={d.id} />}
      <input name="title" className="input" placeholder='כותרת, למשל: רשימת גזברים' defaultValue={d?.title} required />
      <input name="url" className="input" dir="ltr" placeholder="קישור (או לצרף קובץ)" defaultValue={d?.url} />
      <input name="notes" className="input" placeholder="הערות" defaultValue={d?.notes} />
      <div className="flex items-center gap-2">
        <input type="file" name="file" className="min-w-0 flex-1 text-xs" />
        <button className="btn btn-primary btn-sm" disabled={pending}>{d ? 'שמירה' : 'הוספה'}</button>
      </div>
      {d?.file_name && <p className="text-xs text-slate-500 sm:col-span-2">קובץ נוכחי: {d.file_name} (קובץ חדש יחליף אותו)</p>}
      {state?.error && <p className="text-sm text-rose-600 sm:col-span-2">{state.error}</p>}
    </form>
  );
}
