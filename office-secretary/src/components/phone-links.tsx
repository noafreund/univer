import { formatPhone, phoneDigits } from '@/core/normalize';

/** Contact phone numbers as tap-to-call links. `phones` is 'number~label|number~label'. */
export function PhoneLinks({ phones, max = 3, className = '' }: { phones: string | null | undefined; max?: number; className?: string }) {
  if (!phones) return null;
  const list = phones
    .split('|')
    .map((x) => {
      const [number, label] = x.split('~');
      return { number, label };
    })
    .filter((p) => p.number);
  if (!list.length) return null;
  return (
    <span className={`inline-flex max-w-full flex-wrap gap-x-2 gap-y-0.5 ${className}`}>
      {list.slice(0, max).map((p) => (
        <a
          key={p.number}
          href={`tel:${phoneDigits(p.number)}`}
          className="inline-flex max-w-full min-w-0 items-center gap-1 text-brand-700 hover:underline"
          title={p.label ? `${p.number} – ${p.label}` : `חיוג ל-${p.number}`}
        >
          <span aria-hidden>📞</span>
          <span dir="ltr" className="whitespace-nowrap">{formatPhone(p.number)}</span>
          {p.label && <span className="max-w-32 truncate text-[11px] text-slate-400">{p.label}</span>}
        </a>
      ))}
      {list.length > max && <span className="text-[11px] text-slate-400">+{list.length - max}</span>}
    </span>
  );
}
