'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveContactAction, type ContactFormState } from '@/app/actions/contacts';
import { ORG_TYPES, PHONE_LABELS, ROLE_SUGGESTIONS } from '@/core/constants';
import type { ContactOption } from '@/core/data';
import { ContactPicker } from './contact-picker';

type Initial = {
  id?: number;
  name?: string;
  role?: string;
  org?: string;
  assistantId?: number | null;
  notes?: string;
  phones?: { number: string; label: string }[];
  emails?: { email: string; label: string }[];
};

export function ContactForm({ initial = {}, contacts, orgNames }: { initial?: Initial; contacts: ContactOption[]; orgNames: string[] }) {
  const [phones, setPhones] = useState(initial.phones?.length ? initial.phones : [{ number: '', label: 'נייד' }]);
  const [emails, setEmails] = useState(initial.emails?.length ? initial.emails : [{ email: '', label: '' }]);
  const [assistantId, setAssistantId] = useState<number | null>(initial.assistantId ?? null);
  const [org, setOrg] = useState(initial.org ?? '');
  const [state, setState] = useState<ContactFormState>(null);
  const [pending, start] = useTransition();
  const msgRef = useRef<HTMLDivElement>(null);
  // On a phone the message can hide under the keyboard – bring it into view.
  useEffect(() => {
    if (state) {
      (document.activeElement as HTMLElement | null)?.blur();
      msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [state]);
  const orgIsNew = org.trim() !== '' && !orgNames.includes(org.trim());

  function submit(form: HTMLFormElement | null, confirmDuplicate = false) {
    if (!form) return;
    const fd = new FormData(form);
    if (confirmDuplicate) fd.set('confirmDuplicate', '1');
    start(async () => setState(await saveContactAction(fd)));
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">שם *</label>
          <input name="name" className="input" defaultValue={initial.name} required autoFocus />
        </div>
        <div>
          <label className="label">תפקיד</label>
          <input name="role" className="input" defaultValue={initial.role} list="role-suggestions" />
        </div>
        <div>
          <label className="label">ארגון / מועצה</label>
          <input name="org" className="input" value={org} onChange={(e) => setOrg(e.target.value)} list="org-suggestions" />
          {orgIsNew && (
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              ארגון חדש. סוג:
              <select name="orgType" className="input w-auto py-1 text-xs">
                {Object.entries(ORG_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label">המזכירה / מנהלת הלשכה שלו/ה</label>
          <ContactPicker
            contacts={contacts.filter((c) => c.id !== initial.id)}
            value={assistantId}
            onChange={setAssistantId}
            name="assistantId"
            placeholder="בחירה מאנשי הקשר (לא חובה)"
          />
        </div>
      </div>

      <fieldset>
        <legend className="label">טלפונים</legend>
        <div className="space-y-2">
          {phones.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="phone"
                className="input"
                dir="ltr"
                inputMode="tel"
                value={p.number}
                placeholder="050-0000000"
                onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))}
              />
              <input
                name="phoneLabel"
                className="input w-32"
                list="phone-labels"
                value={p.label}
                placeholder="תווית"
                onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <button type="button" className="btn btn-sm" onClick={() => setPhones(phones.filter((_, j) => j !== i))} aria-label="הסרה">✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setPhones([...phones, { number: '', label: '' }])}>+ טלפון</button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">מיילים</legend>
        <div className="space-y-2">
          {emails.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="email"
                type="email"
                className="input"
                dir="ltr"
                value={m.email}
                onChange={(e) => setEmails(emails.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
              />
              <input
                name="emailLabel"
                className="input w-32"
                value={m.label}
                placeholder="תווית"
                onChange={(e) => setEmails(emails.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <button type="button" className="btn btn-sm" onClick={() => setEmails(emails.filter((_, j) => j !== i))} aria-label="הסרה">✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => setEmails([...emails, { email: '', label: '' }])}>+ מייל</button>
        </div>
      </fieldset>

      <div>
        <label className="label">הערות</label>
        <textarea name="notes" rows={3} className="input" defaultValue={initial.notes} />
      </div>

      <div ref={msgRef} />
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.duplicates && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">⚠️ נראה שאיש הקשר כבר קיים:</p>
          <ul className="list-inside list-disc">
            {state.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/contacts/${d.id}`} className="link" target="_blank">{d.name}</Link>{' '}
                <span className="text-slate-500">{[d.role, d.org_name].filter(Boolean).join(' · ')} – {d.reason}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-sm"
            onClick={(e) => submit(e.currentTarget.form, true)}
            disabled={pending}
          >
            זה אדם אחר – לשמור בכל זאת
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary px-6" disabled={pending}>{pending ? 'שומרת...' : 'שמירה'}</button>
        <Link href={initial.id ? `/contacts/${initial.id}` : '/contacts'} className="btn">ביטול</Link>
      </div>

      <datalist id="org-suggestions">{orgNames.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="role-suggestions">{ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="phone-labels">{PHONE_LABELS.map((r) => <option key={r} value={r} />)}</datalist>
    </form>
  );
}
