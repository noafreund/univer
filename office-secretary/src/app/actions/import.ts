'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { safetyCopy } from '@/core/backup';
import { parseWorkbook } from '@/core/importer';
import { clearPending, commitImport, loadPending, savePending } from '@/core/import-commit';

export type ImportState = { error?: string } | null;

export async function uploadImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireUser();
  const file = fd.get('file');
  if (!file || typeof file === 'string' || file.size === 0) return { error: 'צריך לבחור קובץ אקסל' };
  if (!/\.xlsx$/i.test(file.name)) return { error: 'צריך קובץ ‎.xlsx (באקסל: שמירה בשם ← חוברת עבודה של Excel)' };
  try {
    savePending(await parseWorkbook(await file.arrayBuffer(), file.name));
  } catch (e) {
    console.error(e);
    return { error: 'לא הצלחתי לקרוא את הקובץ. ודאי שזה קובץ האקסל של המשרד.' };
  }
  redirect('/import');
}

export async function commitImportAction(fd: FormData) {
  const user = await requireUser();
  const p = loadPending();
  if (!p) redirect('/import');
  const names: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('name:')) names[k.slice(5)] = String(v);
  // a safety copy before writing hundreds of rows
  safetyCopy('import');
  const stats = commitImport(
    p,
    {
      names,
      // groups with several spellings whose "merge" box was unticked
      split: p.orgGroups.filter((g) => g.variants.length > 1 && !fd.getAll('merged').includes(g.key)).map((g) => g.key),
      merges: fd.getAll('merge').map(String),
    },
    user.id,
  );
  clearPending();
  revalidatePath('/', 'layout');
  redirect(`/import?done=${encodeURIComponent(JSON.stringify(stats))}`);
}

export async function cancelImportAction() {
  await requireUser();
  clearPending();
  redirect('/import');
}
