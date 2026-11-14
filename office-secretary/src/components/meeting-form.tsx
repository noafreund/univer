'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { saveMeetingAction, type MeetingFormState } from '@/app/actions/meetings';
import { DEFAULT_SUBJECT, EARLIEST_MEETING_TIME, MEETING_STATES, ROLE_SUGGESTIONS } from "@/core/constants";
import { followUpFor, fmtDate, todayIso } from '@/core/dates';
import type { ContactOption, MeetingRow } from '@/core/data';
import { ContactPicker } from './contact-picker';

type Props = {
  contacts: ContactOption[];
  orgNames: string[];
  meeting?: MeetingRow;
  initialState?: string;
  fixedContactId?: number;
  returnTo?: string;
};

export function MeetingForm({ contacts, orgNames, meeting, initialState, fixedContactId, returnTo }: Props) {
  const [contactId, setContactId] = useState<number | null>(meeting?.contact_id ?? fixedContactId ?? null);
  const [newContact, setNewContact] = useState<string | null>(null);
  const [state, setState] = useState<string>(initialState ?? meeting?.state ?? 'retry_tomorrow');
  const [followUp, setFollowUp] = useState<string>(
    initialState && initialState !== meeting?.state
      ? followUpFor(initialState, todayIso()) ?? ''
      : meeting?.next_follow_up ?? followUpFor('retry_tomorrow', todayIso()) ?? '',
  );
  const [meetingTime, setMeetingTime] = useState(meeting?.meeting_time ?? '');
  const [result, setResult] = useState<MeetingFormState>(null);
  const [pending, start] = useTransition();

  const needsFollowUp = state !== 'meeting_set' && state !== 'nothing';
  const earlyMeeting = meetingTime !== '' && meetingTime < EARLIEST_MEETING_TIME;

  function changeState(s: string) {
    setState(s);
    setFollowUp(followUpFor(s, todayIso()) ?? '');
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setResult(await saveMeetingAction(fd)));
      }}
    >
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">איש קשר *</label>
          {newContact !== null ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-brand-500 p-2">
              <input name="newContactName" className="input" defaultValue={newContact} required />
              <div className="flex gap-2">
                <input name="newContactRole" className="input" placeholder="תפקיד" list="m-role-suggestions" />
                <input name="newContactOrg" className="input" placeholder="ארגון" list="m-org-suggestions" />
                <button type="button" className="btn btn-sm" onClick={() => setNewContact(null)}>✕</button>
              </div>
            </div>
          ) : (
            <ContactPicker contacts={contacts} value={contactId} onChange={setContactId} onAddNew={setNewContact} name="contactId" />
          )}
        </div>
        <div>
          <label className="label">נושא</label>
          <input name="subject" className="input" defaultValue={meeting?.subject ?? DEFAULT_SUBJECT} />
        </div>
      </div>

      <div>
        <span className="label">מצב</span>
        <div className="flex flex-wrap gap-1">
          {Object.entries(MEETING_STATES).map(([k, s]) => (
            <button
              key={k}
              type="button"
              onClick={() => changeState(k)}
              className={`chip cursor-pointer px-3 py-1.5 text-sm ${state === k ? s.color + ' ring-2' : 'bg-white text-slate-600 ring-slate-300'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="state" value={state} />
      </div>

      {needsFollowUp && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
          <div>
            <label className="label">מעקב הבא</label>
            <input type="date" name="nextFollowUp" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} required={state === 'retry_on_date'} />
          </div>
          <p className="pb-2 text-sm text-slate-500">
            {state === 'they_call_back' && 'אם לא יחזרו – תזכורת לבדוק אחרי 10 ימים. '}
            {followUp && `התזכורת תופיע ב"היום שלי" ב-${fmtDate(followUp, true)}`}
          </p>
        </div>
      )}

      {state === 'meeting_set' && (
        <div className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 sm:grid-cols-3">
          <div>
            <label className="label">תאריך הפגישה *</label>
            <input type="date" name="meetingDate" className="input" defaultValue={meeting?.meeting_date ?? ''} required />
          </div>
          <div>
            <label className="label">שעה</label>
            <input type="time" name="meetingTime" className="input" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
          </div>
          <div>
            <label className="label">מקום</label>
            <input name="meetingPlace" className="input" defaultValue={meeting?.meeting_place} />
          </div>
          {earlyMeeting && (
            <p className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-900 sm:col-span-3">
              ⚠️ שימי לב: פגישות קובעים אחרי 12:00. בטוח שזו השעה?
            </p>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="materialsAsked" value="1" className="size-4" defaultChecked={meeting?.materials_asked === 1} />
            שאלתי אם צריך להכין חומרים לפגישה
          </label>
        </div>
      )}
      {state !== 'meeting_set' && (
        <>
          <input type="hidden" name="meetingDate" value={meeting?.meeting_date ?? ''} />
          <input type="hidden" name="meetingTime" value={meeting?.meeting_time ?? ''} />
          <input type="hidden" name="meetingPlace" value={meeting?.meeting_place ?? ''} />
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">מועד יעד (לא חובה)</label>
          <div className="flex gap-2">
            <input type="date" name="deadline" className="input w-auto" defaultValue={meeting?.deadline ?? ''} />
            <input name="deadlineNote" className="input" placeholder='למשל: לפני ועדת ההשגות' defaultValue={meeting?.deadline_note} />
          </div>
        </div>
        <div>
          <label className="label">סטטוס במילים</label>
          <input name="statusText" className="input" placeholder="למשל: המזכירה אמרה שהוא בחו״ל עד ה-20" defaultValue={meeting?.status_text} />
        </div>
      </div>
      <div>
        <label className="label">הערות</label>
        <textarea name="notes" rows={2} className="input" defaultValue={meeting?.notes} />
      </div>

      {meeting?.last_contact && <p className="text-xs text-slate-500">פנייה אחרונה (מיומן השיחות): {fmtDate(meeting.last_contact)}</p>}
      {result?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{result.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary px-6" disabled={pending}>{pending ? 'שומרת...' : 'שמירה'}</button>
        <Link href={returnTo ?? '/meetings'} className="btn">ביטול</Link>
      </div>
      <datalist id="m-org-suggestions">{orgNames.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="m-role-suggestions">{ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
    </form>
  );
}

