'use client';

import { useMemo, useState } from 'react';
import type { ContactOption } from '@/core/data';
import { normalizeText } from '@/core/normalize';

type Props = {
  contacts: ContactOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Called with the typed text when the user wants to add a new contact. */
  onAddNew?: (name: string) => void;
  placeholder?: string;
  name?: string;
  autoFocus?: boolean;
};

export function ContactPicker({ contacts, value, onChange, onAddNew, placeholder, name, autoFocus }: Props) {
  const selected = contacts.find((c) => c.id === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return contacts.slice(0, 8);
    return contacts
      .filter((c) => normalizeText(`${c.name} ${c.org} ${c.role}`).includes(q))
      .slice(0, 8);
  }, [contacts, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-500 bg-brand-50 px-3 py-2 text-sm">
        {name && <input type="hidden" name={name} value={selected.id} />}
        <span className="font-medium">{selected.name}</span>
        <span className="truncate text-slate-500">
          {[selected.role, selected.org].filter(Boolean).join(' · ')}
        </span>
        <button type="button" className="ms-auto text-slate-400 hover:text-slate-700" onClick={() => onChange(null)} aria-label="ניקוי">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className="input"
        value={query}
        placeholder={placeholder ?? 'התחילי להקליד שם / מועצה...'}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (matches[0]) onChange(matches[0].id);
            else if (query.trim() && onAddNew) onAddNew(query.trim());
          }
        }}
      />
      {open && (matches.length > 0 || (query.trim() && onAddNew)) && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full gap-2 px-3 py-2 text-start text-sm hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id);
                  setQuery('');
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="truncate text-slate-500">{[c.role, c.org].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
          {query.trim() && onAddNew && (
            <li>
              <button
                type="button"
                className="w-full border-t border-slate-100 px-3 py-2 text-start text-sm font-medium text-brand-700 hover:bg-brand-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAddNew(query.trim())}
              >
                + הוספת &quot;{query.trim()}&quot; כאיש קשר חדש
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
