import { NextResponse } from 'next/server';
import { currentUser } from '@/core/auth';
import { dataDirAvailable } from '@/core/db';
import { lockStatus, touchLock } from '@/core/lock';

export const dynamic = 'force-dynamic';

/** Called every ~30s by open pages: keeps this computer's lock fresh, and tells the page if it lost it. */
export async function GET() {
  if (!dataDirAvailable()) return NextResponse.json({ state: 'no-drive' });
  const u = await currentUser();
  if (!u) return NextResponse.json({ state: 'logged-out' });
  const s = lockStatus();
  if (!s.free) return NextResponse.json({ state: 'locked' });
  touchLock(u.name);
  return NextResponse.json({ state: 'ok' });
}
