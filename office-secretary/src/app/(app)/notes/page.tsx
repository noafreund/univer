import Link from 'next/link';
import {
  addQuickNoteAction,
  deleteDocAction,
  deletePhoneAction,
  deleteProcedureAction,
  deleteQuickNoteAction,
  savePhoneAction,
  saveProcedureAction,
  toggleQuickNoteAction,
} from '@/app/actions/stage3';
import { ConfirmButton } from '@/components/confirm-button';
import { DocForm } from '@/components/doc-form';
import { ExportButton } from '@/components/export-button';
import { listDocLinks, listProcedures, listQuickNotes, listUsefulPhones, procedureCategories, type QuickNote } from '@/core/data';
import { fmtDate } from '@/core/dates';
import { formatPhone, phoneDigits } from '@/core/normalize';

const TABS = [
  { key: 'quick', label: 'פתקים וקניות', icon: '📝', table: 'notes' },
  { key: 'procedures', label: 'נהלי משרד', icon: '📘', table: 'procedures' },
  { key: 'phones', label: 'טלפונים שימושיים', icon: '☎️', table: 'phones' },
  { key: 'docs', label: 'מסמכים וקישורים', icon: '📎', table: 'docs' },
];
const DEFAULT_CATEGORIES = ['הדפסה', 'ארכיון', 'מיילים', 'רמ"י', 'תשלומים'];

type SP = { tab?: string; q?: string; edit?: string };

export default async function NotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">שליפים</h1>
        <ExportButton table={tab.table} />
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/notes?tab=${t.key}`}
            className={`btn shrink-0 ${t.key === tab.key ? 'border-brand-600 bg-brand-50 text-brand-700' : ''}`}
          >
            {t.icon} {t.label}
          </Link>
        ))}
      </nav>
      {tab.key !== 'quick' && (
        <form className="card flex gap-2 p-3">
          <input type="hidden" name="tab" value={tab.key} />
          <input name="q" defaultValue={sp.q} className="input" placeholder="חיפוש..." />
          <button className="btn">חיפוש</button>
        </form>
      )}
      {tab.key === 'quick' && <QuickNotes />}
      {tab.key === 'procedures' && <Procedures q={sp.q} edit={sp.edit} />}
      {tab.key === 'phones' && <Phones q={sp.q} edit={sp.edit} />}
      {tab.key === 'docs' && <Docs q={sp.q} edit={sp.edit} />}
    </div>
  );
}

function NoteList({ title, items, kind }: { title: string; items: QuickNote[]; kind: 'note' | 'shopping' }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <form action={addQuickNoteAction} className="mb-3 flex gap-2">
        <input type="hidden" name="kind" value={kind} />
        <input name="text" className="input" placeholder={kind === 'shopping' ? 'סלוטייפ, טונר, מעטפות...' : 'פתק חדש...'} required />
        <button className="btn btn-primary">הוספה</button>
      </form>
      <ul className="space-y-1">
        {items.map((n) => (
          <li key={n.id} className="flex items-center gap-2">
            <form action={toggleQuickNoteAction} className="flex-1">
              <input type="hidden" name="id" value={n.id} />
              <button className="flex w-full items-start gap-2 rounded-lg px-2 py-1 text-start text-sm hover:bg-slate-50">
                <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${n.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                  {n.done ? '✓' : ''}
                </span>
                <span className={n.done ? 'text-slate-400 line-through' : ''}>{n.text}</span>
              </button>
            </form>
            <form action={deleteQuickNoteAction}>
              <input type="hidden" name="id" value={n.id} />
              <button className="text-slate-300 hover:text-rose-500" aria-label="מחיקה">✕</button>
            </form>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-slate-400">ריק</li>}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">מה שסומן בוצע נעלם אחרי שבוע.</p>
    </section>
  );
}

function QuickNotes() {
  const notes = listQuickNotes();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <NoteList title="🛒 קניות למשרד" items={notes.filter((n) => n.kind === 'shopping')} kind="shopping" />
      <NoteList title="📝 פתקים" items={notes.filter((n) => n.kind === 'note')} kind="note" />
    </div>
  );
}

function Procedures({ q, edit }: { q?: string; edit?: string }) {
  const items = listProcedures(q);
  const cats = [...new Set([...DEFAULT_CATEGORIES, ...procedureCategories()])];
  const editing = items.find((p) => String(p.id) === edit);
  const groups = [...new Set(items.map((p) => p.category || 'כללי'))];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">{g}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {items.filter((p) => (p.category || 'כללי') === g).map((p) => (
              <details key={p.id} className="card group p-0" open={Boolean(q)}>
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-medium">
                  {p.title}
                  <span className="text-xs text-slate-400 group-open:hidden">פתיחה</span>
                </summary>
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="text-sm leading-7 whitespace-pre-wrap">{p.content}</div>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/notes?tab=procedures&edit=${p.id}#form`} className="btn btn-sm">עריכה</Link>
                    <form action={deleteProcedureAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`למחוק את "${p.title}"?`} className="btn btn-sm btn-danger">מחיקה</ConfirmButton>
                    </form>
                    <span className="ms-auto self-center text-[11px] text-slate-400">עודכן {fmtDate(p.updated_at)}</span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-500">אין נהלים{q ? ' שמתאימים לחיפוש' : ' עדיין'}.</p>}
      <section id="form" className="card p-4">
        <h2 className="mb-3 font-semibold">{editing ? `עריכת "${editing.title}"` : 'נוהל חדש'}</h2>
        <form action={saveProcedureAction} className="space-y-2" key={editing?.id ?? 'new'}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
            <input name="title" className="input" placeholder='למשל: נוהל החתמה ברמ"י' defaultValue={editing?.title} required />
            <input name="category" className="input" placeholder="קטגוריה" list="proc-cats" defaultValue={editing?.category} />
          </div>
          <textarea name="content" rows={8} className="input" placeholder={'1. ...\n2. ...\n3. ...'} defaultValue={editing?.content} />
          <div className="flex gap-2">
            <button className="btn btn-primary">שמירה</button>
            {editing && <Link href="/notes?tab=procedures" className="btn">ביטול</Link>}
          </div>
          <datalist id="proc-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        </form>
      </section>
    </div>
  );
}

function Phones({ q, edit }: { q?: string; edit?: string }) {
  const items = listUsefulPhones(q);
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>שם</th><th>מספר</th><th className="w-full">הערה</th><th /></tr></thead>
        <tbody>
          {items.map((p) =>
            String(p.id) === edit ? (
              <tr key={p.id}>
                <td colSpan={4}>
                  <form action={savePhoneAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" className="input w-40" defaultValue={p.name} required />
                    <input name="number" className="input w-40" dir="ltr" defaultValue={p.number} />
                    <input name="note" className="input flex-1" defaultValue={p.note} />
                    <button className="btn btn-primary btn-sm">שמירה</button>
                    <Link href="/notes?tab=phones" className="btn btn-sm">ביטול</Link>
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td className="font-medium whitespace-nowrap">{p.name}</td>
                <td className="whitespace-nowrap"><a href={`tel:${phoneDigits(p.number)}`} className="link" dir="ltr">{formatPhone(p.number)}</a></td>
                <td className="text-slate-600">{p.note}</td>
                <td className="flex gap-1">
                  <Link href={`/notes?tab=phones&edit=${p.id}`} className="btn btn-sm">עריכה</Link>
                  <form action={deletePhoneAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message={`למחוק את ${p.name}?`} className="btn btn-sm btn-danger">✕</ConfirmButton>
                  </form>
                </td>
              </tr>
            ),
          )}
          <tr>
            <td colSpan={4}>
              <form action={savePhoneAction} className="flex flex-wrap gap-2">
                <input name="name" className="input w-40" placeholder="שם" required />
                <input name="number" className="input w-40" dir="ltr" placeholder="מספר" />
                <input name="note" className="input flex-1" placeholder="הערה" />
                <button className="btn btn-primary btn-sm">הוספה</button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Docs({ q, edit }: { q?: string; edit?: string }) {
  const items = listDocLinks(q);
  const editing = items.find((d) => String(d.id) === edit);
  return (
    <div className="space-y-4">
      <div className="card divide-y divide-slate-100">
        {items.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
            <span className="font-medium">{d.title}</span>
            {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="link">🔗 קישור</a>}
            {d.attachment_id && <a href={`/files/${d.attachment_id}`} target="_blank" className="link">📎 {d.file_name}</a>}
            {d.notes && <span className="text-slate-500">· {d.notes}</span>}
            <span className="ms-auto flex gap-1">
              <Link href={`/notes?tab=docs&edit=${d.id}#form`} className="btn btn-sm">עריכה</Link>
              <form action={deleteDocAction}>
                <input type="hidden" name="id" value={d.id} />
                <ConfirmButton message={`למחוק את "${d.title}"?`} className="btn btn-sm btn-danger">✕</ConfirmButton>
              </form>
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-slate-500">אין מסמכים עדיין.</p>}
      </div>
      <section id="form" className="card p-4">
        <h2 className="mb-3 font-semibold">{editing ? `עריכת "${editing.title}"` : 'מסמך / קישור חדש'}</h2>
        <DocForm d={editing} key={editing?.id ?? 'new'} />
        {editing && <Link href="/notes?tab=docs" className="btn btn-sm mt-2">ביטול</Link>}
      </section>
      <p className="text-xs text-slate-400">🔒 לא שומרים כאן סיסמאות, כרטיסי אשראי או תעודות זהות. אם צריך – לכתוב רק &quot;איפה זה שמור&quot;.</p>
    </div>
  );
}
