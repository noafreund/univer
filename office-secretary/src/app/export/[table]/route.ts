import { requireUser } from '@/core/auth';
import { todayIso } from '@/core/dates';
import { buildWorkbook, SHEETS } from '@/core/export';

export const dynamic = 'force-dynamic';

/** /export/calls → one sheet; /export/all → every table in one workbook. */
export async function GET(_: Request, { params }: { params: Promise<{ table: string }> }) {
  await requireUser();
  const { table } = await params;
  const keys = table === 'all' ? Object.keys(SHEETS) : SHEETS[table] ? [table] : null;
  if (!keys) return new Response('לא נמצא', { status: 404 });
  const name = `${table === 'all' ? 'המשרד-הכול' : SHEETS[table].title}-${todayIso()}.xlsx`;
  return new Response(new Uint8Array(await buildWorkbook(keys)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}
