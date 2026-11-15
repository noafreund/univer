import Link from 'next/link';
import { requireUser } from '@/core/auth';
import { listUsers, pendingHandoversFor } from '@/core/data';
import { siteName } from '@/core/db';
import { releaseLockAction } from '../actions/lock';
import { Heartbeat } from '@/components/heartbeat';
import { HOSTED } from '@/core/mode';
import { logoutAction, switchUserAction } from '../actions/auth';
import { NavLinks } from '@/components/nav-links';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const other = listUsers().find((u) => u.id !== user.id);
  return (
    <div className="min-h-screen md:flex">
      {!HOSTED && <Heartbeat />}
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-e">
        <div className="flex items-center justify-between px-4 py-3 md:block">
          <Link href="/" className="text-lg font-bold text-brand-700">{siteName()}</Link>
          <div className="text-xs text-slate-500 md:mt-1">
            שלום, <span className="font-medium text-slate-700">{user.name}</span>
          </div>
        </div>
        <NavLinks handoverBadge={pendingHandoversFor(user.id).length} />
        <div className="hidden gap-2 px-4 py-4 md:flex md:flex-col">
          {other && (
            <form action={switchUserAction}>
              <input type="hidden" name="userId" value={other.id} />
              <button className="btn btn-sm w-full">החלפה ל{other.name}</button>
            </form>
          )}
          {!HOSTED && <form action={releaseLockAction}>
            <button className="btn btn-sm w-full" title="משחרר את המערכת כדי שהמזכירה השנייה תוכל להיכנס מהמחשב שלה">סיום עבודה (שחרור)</button>
          </form>}
          <form action={logoutAction}>
            <button className="btn btn-sm w-full">יציאה</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur">
          <form action="/search" className="mx-auto flex max-w-6xl gap-2">
            <input
              name="q"
              type="search"
              placeholder="חיפוש: שם, מועצה, טלפון, מילה מהפירוט..."
              className="input"
              aria-label="חיפוש"
            />
            <button className="btn">חיפוש</button>
          </form>
        </header>
        <main className="mx-auto max-w-6xl p-4">{children}</main>
        <div className="flex justify-center gap-2 pb-6 md:hidden">
          {other && (
            <form action={switchUserAction}>
              <input type="hidden" name="userId" value={other.id} />
              <button className="btn btn-sm">החלפה ל{other.name}</button>
            </form>
          )}
          {!HOSTED && (
            <form action={releaseLockAction}>
              <button className="btn btn-sm">סיום עבודה (שחרור)</button>
            </form>
          )}
          <form action={logoutAction}>
            <button className="btn btn-sm">יציאה</button>
          </form>
        </div>
      </div>
    </div>
  );
}
