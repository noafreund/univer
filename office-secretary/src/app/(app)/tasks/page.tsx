import Link from 'next/link';
import { deleteTaskAction, saveTaskAction } from '@/app/actions/tasks';
import { ConfirmButton } from '@/components/confirm-button';
import { ContactPickerField } from '@/components/contact-picker-field';
import { ExportButton } from '@/components/export-button';
import { QuickTaskForm, TaskRow } from '@/components/task-list';
import { requireUser } from '@/core/auth';
import { contactOptions, doneTasks, getTask, listUsers, openTasks, requesterSuggestions, type Task } from '@/core/data';
import { todayIso } from '@/core/dates';

type SP = { who?: string; edit?: string; q?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const today = todayIso();
  const users = listUsers();
  const all = openTasks();
  const open = sp.who === 'all' ? all : all.filter((t) => t.assignee === null || t.assignee === me.id);
  const groups: [string, Task[]][] = [
    ['באיחור', open.filter((t) => t.due_date && t.due_date < today)],
    ['להיום', open.filter((t) => t.due_date === today)],
    ['בהמשך', open.filter((t) => t.due_date && t.due_date > today)],
    ['בלי תאריך', open.filter((t) => !t.due_date)],
  ];
  const done = doneTasks(14, sp.q);
  const editing = sp.edit ? getTask(Number(sp.edit)) : undefined;
  const requesters = requesterSuggestions();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">משימות</h1>
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            <Link href="/tasks" className={`rounded-md px-3 py-1 ${sp.who !== 'all' ? 'bg-brand-600 text-white' : ''}`}>שלי + משותפות</Link>
            <Link href="/tasks?who=all" className={`rounded-md px-3 py-1 ${sp.who === 'all' ? 'bg-brand-600 text-white' : ''}`}>הכול</Link>
          </div>
          <ExportButton table="tasks" />
        </div>
      </div>
      <p className="text-sm text-slate-500">
        דברים שמבקשים מכן במהלך היום. נשארים ברשימה עד שמסמנים ✓ (לא מתאפסים כמו המשימות הקבועות).
      </p>

      <section className="card">
        <QuickTaskForm requesters={requesters} returnTo={sp.who === 'all' ? '/tasks?who=all' : '/tasks'} />
        {open.length === 0 && <p className="p-6 text-center text-sm text-slate-500">אין משימות פתוחות 🎉</p>}
        {groups.map(([label, items]) =>
          items.length ? (
            <div key={label}>
              <h2 className={`bg-slate-50 px-3 py-1.5 text-xs font-semibold ${label === 'באיחור' ? 'text-rose-600' : 'text-slate-500'}`}>
                {label} ({items.length})
              </h2>
              <ul className="divide-y divide-slate-100">{items.map((t) => <TaskRow key={t.id} t={t} today={today} />)}</ul>
            </div>
          ) : null,
        )}
      </section>

      <section id="form" className="card p-4">
        <h2 className="mb-3 font-semibold">{editing ? 'עריכת משימה' : 'משימה מפורטת'}</h2>
        <form action={saveTaskAction} className="space-y-3" key={editing?.id ?? 'new'}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="returnTo" value="/tasks" />
          <input name="title" className="input" placeholder="מה צריך לעשות?" defaultValue={editing?.title} required />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">מי ביקש</label>
              <input name="requestedBy" className="input" list="requesters" defaultValue={editing?.requested_by} />
            </div>
            <div>
              <label className="label">למי</label>
              <select name="assignee" className="input" defaultValue={editing ? (editing.assignee ?? '') : me.id}>
                <option value="">לשתינו</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">עד מתי</label>
              <input type="date" name="due" className="input" defaultValue={editing?.due_date ?? ''} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="urgent" value="1" className="size-4" defaultChecked={editing?.urgent === 1} /> דחוף
            </label>
          </div>
          <div>
            <label className="label">קשור לאיש קשר (לא חובה)</label>
            <ContactPickerField contacts={contactOptions()} name="contactId" initial={editing?.contact_id} placeholder="בחירה מאנשי הקשר" />
          </div>
          <textarea name="notes" rows={2} className="input" placeholder="פרטים נוספים" defaultValue={editing?.notes} />
          <div className="flex gap-2">
            <button className="btn btn-primary">שמירה</button>
            {editing && <Link href="/tasks" className="btn">ביטול</Link>}
          </div>
          <datalist id="requesters">{requesters.map((r) => <option key={r} value={r} />)}</datalist>
        </form>
        {editing && (
          <form action={deleteTaskAction} className="mt-2">
            <input type="hidden" name="id" value={editing.id} />
            <ConfirmButton message="למחוק את המשימה?" className="btn btn-sm btn-danger">מחיקה</ConfirmButton>
          </form>
        )}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">בוצעו בשבועיים האחרונים ({done.length})</h2>
          <form className="flex gap-2">
            {sp.who && <input type="hidden" name="who" value={sp.who} />}
            <input name="q" defaultValue={sp.q} placeholder="חיפוש..." className="input py-1" />
          </form>
        </div>
        <ul className="divide-y divide-slate-100">{done.map((t) => <TaskRow key={t.id} t={t} today={today} showEdit={false} />)}</ul>
        {done.length === 0 && <p className="p-4 text-sm text-slate-500">עוד לא בוצעו משימות.</p>}
      </section>
    </div>
  );
}
