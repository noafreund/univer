import fs from 'node:fs';
import path from 'node:path';
import { requireUser } from '@/core/auth';
import { backupPath, freshBackupFile } from '@/core/backup';

export const dynamic = 'force-dynamic';

/** ?name=office-2026-11-14.db → that daily backup; no name → a fresh copy right now. */
export async function GET(req: Request) {
  await requireUser();
  const name = new URL(req.url).searchParams.get('name');
  const file = name ? backupPath(name) : freshBackupFile();
  if (!file) return new Response('לא נמצא', { status: 404 });
  const data = fs.readFileSync(file);
  if (!name) fs.rmSync(file, { force: true });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
