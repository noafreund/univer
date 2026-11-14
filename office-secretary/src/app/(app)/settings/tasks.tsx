import { deleteDailyTaskAction, saveDailyTaskAction } from '@/app/actions/daily';
import { ConfirmButton } from '@/components/confirm-button';
import type { DailyTask } from '@/core/data';

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const SHIFTS = { any: 'שתי המשמרות', morning: 'בוקר', afternoon: 'צהריים' };

function TaskFields({ t }: { t?: DailyTask }) {
  return (
    <>
      <input name="title" className="input min-w-48 flex-1" defaultValue={t?.title} placeholder="משימה חדשה..." required />
      <div className="flex items-center gap-1 text-xs" title="באילו ימים (בלי סימון = כל יום)">
        {DAYS.map((d, i) => (
          <label key={i} className="flex cursor-pointer flex-col items-center">
            <input type="checkbox" name="weekday" value={i} defaultChecked={t?.weekdays.includes(String(i))} className="size-4" />
            {d}
          </label>
        ))}
      </div>
      <select name="shift" className="input w-auto" defaultValue={t?.shift ?? 'any'}>
        {Object.entries(SHIFTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </>
  );
}

export function DailyTasksEditor({ tasks }: { tasks: DailyTask[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">
        הרשימה מתאפסת לבד כל בוקר. ימים: בלי סימון = כל יום; אפשר לסמן ימים מסוימים (למשל רק ד׳ לרביעי).
      </p>
      {tasks.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
          <form action={saveDailyTaskAction} className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="sort" value={t.sort} />
            <TaskFields t={t} />
            <button className="btn btn-sm">שמירה</button>
          </form>
          <form action={deleteDailyTaskAction}>
            <input type="hidden" name="id" value={t.id} />
            <ConfirmButton message={`למחוק את "${t.title}"?`} className="btn btn-sm btn-danger">מחיקה</ConfirmButton>
          </form>
        </div>
      ))}
      <form action={saveDailyTaskAction} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-brand-500 p-2">
        <TaskFields />
        <button className="btn btn-sm btn-primary">הוספה</button>
      </form>
    </div>
  );
}
