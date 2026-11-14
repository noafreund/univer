'use client';

import { useActionState } from 'react';
import { uploadImportAction } from '@/app/actions/import';

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadImportAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="file" name="file" accept=".xlsx" className="block text-sm" required />
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? 'קוראת את הקובץ...' : 'קריאת הקובץ (עוד לא נשמר כלום)'}</button>
    </form>
  );
}
