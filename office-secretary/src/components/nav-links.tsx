'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'היום שלי', icon: '🏠' },
  { href: '/calls', label: 'יומן שיחות', icon: '📞' },
  { href: '/meetings', label: 'מעקב פגישות', icon: '📅' },
  { href: '/handover', label: 'העברת משמרת', icon: '🔁' },
  { href: '/contacts', label: 'אנשי קשר', icon: '👤' },
  { href: '/appeals', label: 'ועדת השגות', icon: '⚖️' },
  { href: '/publications', label: 'פרוטוקולים', icon: '📰' },
  { href: '/notes', label: 'שליפים', icon: '📝' },
  { href: '/organizations', label: 'ארגונים', icon: '🏛️' },
  { href: '/settings', label: 'הגדרות', icon: '⚙️' },
];

export function NavLinks({ handoverBadge = 0 }: { handoverBadge?: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
              active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden>{l.icon}</span>
            {l.label}
            {l.href === '/handover' && handoverBadge > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{handoverBadge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
