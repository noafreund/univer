'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setMeetingStateAction } from '@/app/actions/meetings';
import { MEETING_STATES } from '@/core/constants';
import type { MeetingRow } from '@/core/data';
import { fmtDate } from '@/core/dates';

export function Kanban({ meetings, today }: { meetings: MeetingRow[]; today: string }) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  function move(id: number, state: string) {
    const fd = new FormData();
    fd.set('id', String(id));
    fd.set('state', state);
    start(() => setMeetingStateAction(fd));
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {Object.entries(MEETING_STATES).map(([key, s]) => {
        const cards = meetings.filter((m) => m.state === key);
        return (
          <div
            key={key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(key);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (dragId) move(dragId, key);
              setDragId(null);
              setOver(null);
            }}
            className={`w-64 shrink-0 rounded-xl border-t-4 bg-slate-100/70 p-2 ${s.col} ${over === key ? 'ring-2 ring-brand-500' : ''}`}
          >
            <h3 className="mb-2 flex justify-between px-1 text-sm font-semibold text-slate-700">
              {s.label} <span className="text-slate-400">{cards.length}</span>
            </h3>
            <div className="space-y-2">
              {cards.map((m) => {
                const overdue = m.next_follow_up && m.next_follow_up < today;
                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={() => setDragId(m.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm"
                  >
                    <Link href={`/meetings/${m.id}`} className="link font-medium">{m.contact_name}</Link>
                    <div className="text-xs text-slate-500">{[m.contact_role, m.org_name].filter(Boolean).join(' · ')}</div>
                    {m.status_text && <div className="mt-1 text-xs text-slate-600">{m.status_text}</div>}
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      {m.next_follow_up && (
                        <span className={overdue ? 'font-bold text-rose-600' : 'text-slate-500'}>מעקב: {fmtDate(m.next_follow_up)}</span>
                      )}
                      {m.meeting_date && key === 'meeting_set' && (
                        <span className="text-emerald-700">📅 {fmtDate(m.meeting_date)} {m.meeting_time}</span>
                      )}
                      {m.deadline && <span className="text-amber-700">⏰ יעד {fmtDate(m.deadline)}</span>}
                    </div>
                    <select
                      aria-label="העברה למצב"
                      className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs"
                      value={key}
                      onChange={(e) => move(m.id, e.target.value)}
                    >
                      {Object.entries(MEETING_STATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
