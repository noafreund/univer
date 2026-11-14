import { DIRECTIONS, MEETING_STATES, RESULTS, type Direction, type MeetingState, type Result } from '@/core/constants';

export function ResultChip({ result }: { result: string }) {
  const r = RESULTS[result as Result];
  if (!r) return <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{result}</span>;
  return <span className={`chip ${r.color}`}>{r.label}</span>;
}

export function DirectionChip({ direction }: { direction: string }) {
  const out = direction === 'out';
  return (
    <span className={`chip ${out ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-teal-50 text-teal-700 ring-teal-200'}`}>
      {out ? '↖ ' : '↘ '}
      {DIRECTIONS[direction as Direction] ?? direction}
    </span>
  );
}

export function OpenChip({ open }: { open: boolean }) {
  return open ? (
    <span className="chip bg-orange-50 text-orange-700 ring-orange-200">פתוח</span>
  ) : (
    <span className="chip bg-slate-50 text-slate-500 ring-slate-200">סגור</span>
  );
}

export function StateChip({ state }: { state: string }) {
  const s = MEETING_STATES[state as MeetingState];
  if (!s) return <span className="chip bg-slate-100 text-slate-600 ring-slate-200">{state}</span>;
  return <span className={`chip ${s.color}`}>{s.label}</span>;
}
