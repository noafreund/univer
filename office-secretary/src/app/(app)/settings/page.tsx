import { listDailyTasks, listUsers } from '@/core/data';
import { DailyTasksEditor } from './tasks';
import { RestoreForm } from './restore-form';
import { listBackups } from '@/core/backup';
import { SHEETS } from '@/core/export';
import { DB_PATH, siteName } from '@/core/db';
import { HOSTED } from '@/core/mode';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  const users = listUsers();
  const backups = listBackups();
  return (
    <div className="space-y-4">
      <h1 className="page-title">הגדרות</h1>
      <section className="card p-4">
        <SettingsForm
          morning={users.find((u) => u.shift === 'morning')?.name ?? ''}
          afternoon={users.find((u) => u.shift === 'afternoon')?.name ?? ''}
          site={siteName()}
        />
      </section>
      <section id="tasks" className="card p-4">
        <h2 className="mb-2 font-semibold">משימות יומיות קבועות</h2>
        <DailyTasksEditor tasks={listDailyTasks()} />
      </section>
      <section className="card flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <h2 className="font-semibold">ייבוא מהאקסל הישן</h2>
          <p className="text-sm text-slate-500">קריאת קובץ האקסל של המשרד, עם בדיקה ואישור לפני שמירה.</p>
        </div>
        <a href="/import" className="btn">📤 ייבוא מאקסל</a>
      </section>
      <section id="backup" className="card space-y-3 p-4">
        <h2 className="font-semibold">גיבוי וייצוא</h2>
        <p className="text-sm text-slate-600">
          המערכת שומרת לבד עותק של כל המידע פעם ביום ({backups.length} עותקים שמורים, עד 30 ימים אחורה).
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/backup/download" className="btn btn-primary">💾 הורדת גיבוי מלא עכשיו</a>
          <a href="/export/all" className="btn">📥 כל המידע לאקסל (קובץ אחד)</a>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">ייצוא טבלה בודדת לאקסל</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(SHEETS).map(([k, v]) => <a key={k} href={`/export/${k}`} className="btn btn-sm">{v.title}</a>)}
          </div>
        </details>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">גיבויים יומיים שמורים</summary>
          <ul className="mt-2 space-y-1">
            {backups.map((b) => (
              <li key={b.name}>
                <a href={`/backup/download?name=${b.name}`} className="link" dir="ltr">{b.name}</a>
                <span className="ms-2 text-xs text-slate-400">{(b.size / 1024 / 1024).toFixed(1)}MB</span>
              </li>
            ))}
          </ul>
        </details>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">שחזור מגיבוי (רק במקרה חירום)</summary>
          <div className="mt-2"><RestoreForm /></div>
        </details>
        <p className="text-xs text-slate-400">
          💡 קובץ הגיבוי (‎.db) מכיל את כל המידע כולל קבצים מצורפים. הקובץ לאקסל נוח לקריאה, אבל אי אפשר לשחזר ממנו.
          כדאי להוריד גיבוי פעם בשבוע ולשמור אותו ב-OneDrive.
        </p>
      </section>
      {!HOSTED && <section className="card p-4 text-sm text-slate-600">
        <h2 className="mb-1 font-semibold text-slate-800">איפה המידע נשמר</h2>
        <p dir="ltr" className="text-start font-mono text-xs">{DB_PATH}</p>
      </section>}
      <p className="text-center text-xs text-slate-400" dir="ltr">
        גרסה: {(process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local').slice(0, 7)}
      </p>
    </div>
  );
}
