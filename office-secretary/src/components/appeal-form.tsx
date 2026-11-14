'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveAppealAction } from '@/app/actions/stage3';
import type { AppealSession } from '@/core/data';

const DOCS = [
  { key: 'agenda', label: 'סדר יום' },
  { key: 'protocol', label: 'פרוטוקול' },
  { key: 'decisions', label: 'החלטות' },
] as const;

export function AppealForm({ s }: { s?: AppealSession }) {
  const [state, action, pending] = useActionState(saveAppealAction, null);
  return (
    <form action={action} className="space-y-4">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="max-w-xs">
        <label className="label">תאריך הישיבה *</label>
        <input type="date" name="sessionDate" className="input" defaultValue={s?.session_date} required />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {DOCS.map((d) => {
          const fileId = s?.[`${d.key}_file`];
          const fileName = s?.[`${d.key}_file_name`];
          return (
            <fieldset key={d.key} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" name={`${d.key}Received`} value="1" className="size-4" defaultChecked={s?.[`${d.key}_received`] === 1} />
                התקבל {d.label}
              </label>
              <input name={`${d.key}Link`} className="input" dir="ltr" placeholder="קישור (לא חובה)" defaultValue={s?.[`${d.key}_link`]} />
              {fileId ? (
                <div className="flex items-center gap-2 text-sm">
                  📎 <a href={`/files/${fileId}`} target="_blank" className="link truncate">{fileName}</a>
                  <label className="ms-auto flex items-center gap-1 text-xs text-slate-500">
                    <input type="checkbox" name={`${d.key}RemoveFile`} value="1" /> הסרה
                  </label>
                </div>
              ) : null}
              <input type="file" name={`${d.key}File`} className="block w-full text-xs" />
            </fieldset>
          );
        })}
      </div>
      <div>
        <label className="label">הערות</label>
        <textarea name="notes" rows={2} className="input" defaultValue={s?.notes} />
      </div>
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary px-6" disabled={pending}>{pending ? 'שומרת...' : 'שמירה'}</button>
        {s && <Link href="/appeals" className="btn">ביטול</Link>}
      </div>
    </form>
  );
}
