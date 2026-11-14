'use client';

import { useActionState, useState } from 'react';
import { uploadImportAction } from '@/app/actions/import';

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadImportAction, null);
  const [fileName, setFileName] = useState('');
  return (
    <form action={action} className="space-y-3">
      {/* The whole box is a <label>, so tapping anywhere on it opens the file picker (works on iPhone too). */}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-500 bg-brand-50/50 p-6 text-center hover:bg-brand-50">
        <span className="text-3xl" aria-hidden>📄</span>
        <span className="font-semibold text-brand-700">{fileName ? 'נבחר הקובץ:' : 'לחצי כאן לבחירת קובץ האקסל'}</span>
        {fileName && <span className="text-sm break-all text-slate-700" dir="ltr">{fileName}</span>}
        {!fileName && <span className="text-xs text-slate-500">באייפון: לבחור &quot;עיון&quot; / &quot;בחירת קובץ&quot; ← אפליקציית קבצים</span>}
        <input
          type="file"
          name="file"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
        />
      </label>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn btn-primary w-full py-3 text-base" disabled={pending || !fileName}>
        {pending ? 'קוראת את הקובץ... (עד דקה)' : fileName ? 'קריאת הקובץ (עוד לא נשמר כלום)' : 'קודם בוחרים קובץ ☝️'}
      </button>
    </form>
  );
}
