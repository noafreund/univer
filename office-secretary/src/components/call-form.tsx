'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { saveCallAction, type CallFormState } from '@/app/actions/calls';
import { DIRECTIONS, OPEN_BY_DEFAULT, RESULTS, ROLE_SUGGESTIONS, type Result } from '@/core/constants';
import { nowParts } from '@/core/dates';
import type { CallRow, ContactOption } from '@/core/data';
import { ContactPicker } from './contact-picker';

type Props = {
  contacts: ContactOption[];
  orgNames: string[];
  /** Existing call → edit mode. */
  call?: CallRow;
  /** Pre-select a contact (e.g. from the contact card). */
  fixedContactId?: number;
  returnTo?: string;
};

export function CallForm({ contacts, orgNames, call, fixedContactId, returnTo }: Props) {
  const editing = Boolean(call);
  const [contactId, setContactId] = useState<number | null>(call?.contact_id ?? fixedContactId ?? null);
  const [newContact, setNewContact] = useState<string | null>(null);
  const [direction, setDirection] = useState<string>(call?.direction ?? 'out');
  const [result, setResult] = useState<string>(call?.result ?? '');
  const [isOpen, setIsOpen] = useState<boolean>(call ? call.is_open === 1 : true);
  const [openTouched, setOpenTouched] = useState(editing);
  const [when, setWhen] = useState(() =>
    call ? { date: call.occurred_at.slice(0, 10), time: call.occurred_at.slice(11, 16) } : { date: '', time: '' },
  );
  const [whenTouched, setWhenTouched] = useState(editing);
  const [state, setState] = useState<CallFormState>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state]);

  // Keep the date/time at "now" until the user changes it by hand.
  useEffect(() => {
    if (whenTouched) return;
    const tick = () => setWhen(nowParts());
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [whenTouched]);

  function pickResult(r: string) {
    setResult(r);
    if (!openTouched) setIsOpen(OPEN_BY_DEFAULT.includes(r as Result));
  }

  function reset() {
    formRef.current?.reset();
    setContactId(fixedContactId ?? null);
    setNewContact(null);
    setDirection('out');
    setResult('');
    setIsOpen(true);
    setOpenTouched(false);
    setWhenTouched(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    start(async () => {
      const res = await saveCallAction(fd);
      setState(res);
      if (res?.ok) reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      {call && <input type="hidden" name="id" value={call.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <label className="label">איש קשר</label>
          {newContact !== null ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-brand-500 bg-brand-50/50 p-2 sm:grid-cols-3">
              <input name="newContactName" className="input" defaultValue={newContact} placeholder="שם" required />
              <input name="newContactRole" className="input" placeholder="תפקיד" list="role-suggestions" />
              <div className="flex gap-2">
                <input name="newContactOrg" className="input" placeholder="ארגון / מועצה" list="org-suggestions" />
                <button type="button" className="btn btn-sm" onClick={() => setNewContact(null)} aria-label="ביטול">✕</button>
              </div>
            </div>
          ) : (
            <ContactPicker
              contacts={contacts}
              value={contactId}
              onChange={setContactId}
              onAddNew={(n) => {
                setNewContact(n);
                setContactId(null);
              }}
              name="contactId"
              autoFocus={!editing && !fixedContactId}
            />
          )}
        </div>
        <div className="flex items-end">
          <button
            name="quick"
            value="no_answer"
            className="btn w-full border-slate-400 font-bold md:w-auto"
            disabled={pending || (!contactId && newContact === null)}
            title='תיעוד "אין מענה" מיידי עם השעה של עכשיו'
          >
            📵 א&quot;מ
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">כיוון</span>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(DIRECTIONS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDirection(k)}
                className={`btn ${direction === k ? 'border-brand-600 bg-brand-50 text-brand-700' : ''}`}
              >
                {v}
              </button>
            ))}
          </div>
          <input type="hidden" name="direction" value={direction} />
        </div>
        <div>
          <label className="label">עם מי דיברתי בפועל (אם לא איתו/ה)</label>
          <input name="spokeWith" className="input" placeholder='למשל: המזכירה, המוקד' defaultValue={call?.spoke_with} />
        </div>
      </div>

      <div>
        <span className="label">תוצאה</span>
        <div className="flex flex-wrap gap-1">
          {Object.entries(RESULTS).map(([k, r]) => (
            <button
              key={k}
              type="button"
              onClick={() => pickResult(k)}
              className={`chip cursor-pointer px-3 py-1.5 text-sm ${result === k ? r.color + ' ring-2' : 'bg-white text-slate-600 ring-slate-300'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="result" value={result} />
      </div>

      <div>
        <label className="label">פירוט</label>
        <textarea name="details" rows={2} className="input" defaultValue={call?.details} placeholder="מה נאמר, למה לחזור..." />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">תאריך</label>
          <input
            type="date"
            name="date"
            className="input"
            value={when.date}
            onChange={(e) => {
              setWhenTouched(true);
              setWhen((w) => ({ ...w, date: e.target.value }));
            }}
          />
        </div>
        <div>
          <label className="label">שעה</label>
          <input
            type="time"
            name="time"
            className="input"
            value={when.time}
            onChange={(e) => {
              setWhenTouched(true);
              setWhen((w) => ({ ...w, time: e.target.value }));
            }}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={isOpen}
            onChange={(e) => {
              setOpenTouched(true);
              setIsOpen(e.target.checked);
            }}
          />
          פתוח (צריך עוד טיפול)
        </label>
        <input type="hidden" name="isOpen" value={isOpen ? '1' : '0'} />
        <button className="btn btn-primary ms-auto px-6" disabled={pending}>
          {pending ? 'שומרת...' : editing ? 'שמירת שינויים' : 'שמירת שיחה'}
        </button>
      </div>

      <div ref={msgRef} />
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✓ {state.message}
          {state.meetingContactId && (
            <a
              href={state.meetingId ? `/meetings/${state.meetingId}?state=meeting_set` : `/meetings/new?contact=${state.meetingContactId}`}
              className="ms-2 font-semibold underline"
            >
              למילוי תאריך, שעה ומקום הפגישה ←
            </a>
          )}
        </p>
      )}

      <datalist id="org-suggestions">
        {orgNames.map((o) => <option key={o} value={o} />)}
      </datalist>
      <datalist id="role-suggestions">
        {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
      </datalist>
    </form>
  );
}
