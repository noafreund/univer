import { listDailyTasks, listUsers } from '@/core/data';
import { DailyTasksEditor } from './tasks';
import { DB_PATH } from '@/core/db';
import { HOSTED } from '@/core/mode';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const users = listUsers();
  return (
    <div className="space-y-4">
      <h1 className="page-title">הגדרות</h1>
      <section className="card p-4">
        <SettingsForm
          morning={users.find((u) => u.shift === 'morning')?.name ?? ''}
          afternoon={users.find((u) => u.shift === 'afternoon')?.name ?? ''}
        />
      </section>
      <section id="tasks" className="card p-4">
        <h2 className="mb-2 font-semibold">משימות יומיות קבועות</h2>
        <DailyTasksEditor tasks={listDailyTasks()} />
      </section>
      {!HOSTED && <section className="card p-4 text-sm text-slate-600">
        <h2 className="mb-1 font-semibold text-slate-800">איפה המידע נשמר</h2>
        <p dir="ltr" className="text-start font-mono text-xs">{DB_PATH}</p>
      </section>}
    </div>
  );
}
