import 'server-only';
import { run } from './db';

export const MAX_UPLOAD_MB = 15;

/** Store an uploaded file in the database. Returns its id, null when no file was chosen, or an error string. */
export async function saveUpload(value: FormDataEntryValue | null, userId: number): Promise<number | null | string> {
  if (!value || typeof value === 'string' || value.size === 0) return null;
  if (value.size > MAX_UPLOAD_MB * 1024 * 1024) return `הקובץ גדול מדי (מקסימום ${MAX_UPLOAD_MB}MB)`;
  const bytes = new Uint8Array(await value.arrayBuffer());
  return run(
    'INSERT INTO attachments (name, mime, size, data, created_by) VALUES (?,?,?,?,?)',
    value.name || 'קובץ', value.type || 'application/octet-stream', value.size, bytes, userId,
  ).id;
}

/** Delete attachments that nothing points to anymore. */
export function pruneAttachments() {
  run(`DELETE FROM attachments WHERE id NOT IN (
    SELECT agenda_file FROM appeal_sessions WHERE agenda_file IS NOT NULL
    UNION SELECT protocol_file FROM appeal_sessions WHERE protocol_file IS NOT NULL
    UNION SELECT decisions_file FROM appeal_sessions WHERE decisions_file IS NOT NULL
    UNION SELECT attachment_id FROM doc_links WHERE attachment_id IS NOT NULL)`);
}
