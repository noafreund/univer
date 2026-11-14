import { requireUser } from '@/core/auth';
import { get } from '@/core/db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const f = get<{ name: string; mime: string; data: Uint8Array }>('SELECT name, mime, data FROM attachments WHERE id = ?', Number(id));
  if (!f) return new Response('לא נמצא', { status: 404 });
  const inline = /^(application\/pdf|image\/)/.test(f.mime);
  return new Response(Buffer.from(f.data), {
    headers: {
      'Content-Type': f.mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
