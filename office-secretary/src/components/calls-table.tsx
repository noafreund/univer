import Link from 'next/link';
import { deleteCallAction, quickNoAnswerAction, toggleCallOpenAction } from '@/app/actions/calls';
import type { CallRow } from '@/core/data';
import { fmtDate, fmtTime } from '@/core/dates';
import { DirectionChip, OpenChip, ResultChip } from './badges';
import { ConfirmButton } from './confirm-button';

export function CallsTable({ rows, hideContact }: { rows: CallRow[]; hideContact?: boolean }) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-slate-500">אין שיחות להצגה</p>;
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th>תאריך</th>
              {!hideContact && <th>איש קשר</th>}
              <th>כיוון</th>
              <th>תוצאה</th>
              <th className="w-full">פירוט</th>
              <th>מצב</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className="whitespace-nowrap">
                  <div>{fmtDate(c.occurred_at)}</div>
                  <div className="text-xs text-slate-400">{fmtTime(c.occurred_at)}</div>
                </td>
                {!hideContact && (
                  <td className="whitespace-nowrap">
                    {c.contact_id ? (
                      <Link href={`/contacts/${c.contact_id}`} className="link font-medium">{c.contact_name}</Link>
                    ) : (
                      <span>{c.spoke_with || '—'}</span>
                    )}
                    <div className="text-xs text-slate-500">{[c.contact_role, c.org_name].filter(Boolean).join(' · ')}</div>
                  </td>
                )}
                <td><DirectionChip direction={c.direction} /></td>
                <td><ResultChip result={c.result} /></td>
                <td>
                  {c.spoke_with && c.contact_id && <span className="text-xs text-slate-500">דיברתי עם {c.spoke_with}. </span>}
                  <span className="whitespace-pre-wrap">{c.details}</span>
                  {c.created_by_name && <div className="text-[11px] text-slate-400">תועד ע״י {c.created_by_name}</div>}
                </td>
                <td>
                  <form action={toggleCallOpenAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button title="לחיצה מחליפה פתוח/סגור" className="cursor-pointer"><OpenChip open={c.is_open === 1} /></button>
                  </form>
                </td>
                <td><RowActions c={c} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((c) => (
          <li key={c.id} className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {!hideContact &&
                  (c.contact_id ? (
                    <Link href={`/contacts/${c.contact_id}`} className="link font-medium">{c.contact_name}</Link>
                  ) : (
                    <span className="font-medium">{c.spoke_with || '—'}</span>
                  ))}
                <span className="ms-2 text-xs text-slate-500">{c.org_name}</span>
              </div>
              <span className="text-xs whitespace-nowrap text-slate-400">{fmtDate(c.occurred_at)} {fmtTime(c.occurred_at)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <DirectionChip direction={c.direction} />
              <ResultChip result={c.result} />
              <form action={toggleCallOpenAction} className="inline">
                <input type="hidden" name="id" value={c.id} />
                <button><OpenChip open={c.is_open === 1} /></button>
              </form>
            </div>
            {c.details && <p className="text-sm whitespace-pre-wrap text-slate-700">{c.details}</p>}
            <RowActions c={c} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RowActions({ c }: { c: CallRow }) {
  return (
    <div className="flex gap-1">
      {c.contact_id && (
        <form action={quickNoAnswerAction}>
          <input type="hidden" name="contactId" value={c.contact_id} />
          <button className="btn btn-sm whitespace-nowrap" title='ניסיתי שוב עכשיו – אין מענה'>+א&quot;מ</button>
        </form>
      )}
      <Link href={`/calls/${c.id}/edit`} className="btn btn-sm">עריכה</Link>
      <form action={deleteCallAction}>
        <input type="hidden" name="id" value={c.id} />
        <ConfirmButton message="למחוק את השיחה?" className="btn btn-sm btn-danger">מחיקה</ConfirmButton>
      </form>
    </div>
  );
}
