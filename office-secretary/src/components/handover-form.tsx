'use client';

import { useState, useTransition } from 'react';
import { sendHandoverAction, type HandoverFormState } from '@/app/actions/handover';
import type { ContactOption } from '@/core/data';
import { ContactPicker } from './contact-picker';

type Item = { key: number; text: string; urgent: boolean; contactId: number | null };
export type Suggestion = { text: string; contactId: number | null; kind: string };

let seq = 0;

export function HandoverForm({
  contacts,
  suggestions,
  summary,
  otherName,
  showRelease = true,
}: {
  contacts: ContactOption[];
  suggestions: Suggestion[];
  summary: string;
  otherName: string;
  showRelease?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([{ key: ++seq, text: '', urgent: false, contactId: null }]);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [state, setState] = useState<HandoverFormState>(null);
  const [pending, start] = useTransition();

  const update = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  function addSuggestion(i: number) {
    const s = suggestions[i];
    setItems((xs) => [...xs.filter((x) => x.text.trim() || x.contactId), { key: ++seq, text: s.text, urgent: false, contactId: s.contactId }]);
    setUsed((u) => new Set(u).add(i));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await sendHandoverAction(fd)));
      }}
    >
      <input type="hidden" name="summary" value={summary} />

      {suggestions.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-600">דברים פתוחים מהמשמרת – לחיצה מוסיפה למשימות:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                disabled={used.has(i)}
                onClick={() => addSuggestion(i)}
                className="btn btn-sm max-w-full text-start disabled:opacity-40"
              >
                <span className="truncate">+ {s.kind}: {s.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <fieldset>
        <legend className="label">משימות שאני מעבירה ל{otherName}</legend>
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.key} className={`grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_14rem_auto_auto] ${it.urgent ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
              <input
                name="itemText"
                className="input"
                placeholder="מה צריך לעשות?"
                value={it.text}
                onChange={(e) => update(it.key, { text: e.target.value })}
              />
              <ContactPicker
                contacts={contacts}
                value={it.contactId}
                onChange={(id) => update(it.key, { contactId: id })}
                placeholder="איש קשר (לא חובה)"
              />
              <input type="hidden" name="itemContact" value={it.contactId ?? ''} />
              <input type="hidden" name="itemUrgent" value={it.urgent ? '1' : '0'} />
              <button
                type="button"
                className={`btn ${it.urgent ? 'border-rose-400 bg-rose-100 text-rose-700' : ''}`}
                onClick={() => update(it.key, { urgent: !it.urgent })}
              >
                {it.urgent ? '🔴 דחוף' : 'דחוף?'}
              </button>
              <button type="button" className="btn" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} aria-label="הסרה">✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setItems((xs) => [...xs, { key: ++seq, text: '', urgent: false, contactId: null }])}>
            + משימה
          </button>
        </div>
      </fieldset>

      <div>
        <label className="label">לתשומת לבך (חופשי)</label>
        <textarea name="notes" rows={4} className="input" placeholder="למשל: גזבר עמק חפר אמור לחזור – לבקש ממנו את המייל. הטונר כמעט נגמר." />
      </div>

      {showRelease && <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="release" value="1" defaultChecked className="size-4" />
        לשחרר את המערכת אחרי השליחה (כדי ש{otherName} תוכל להיכנס מהמחשב שלה)
      </label>}

      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      <button className="btn btn-primary px-6" disabled={pending}>{pending ? 'שולחת...' : `שליחת העברת משמרת ל${otherName}`}</button>
    </form>
  );
}
