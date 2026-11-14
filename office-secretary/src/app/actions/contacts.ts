'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/core/auth';
import { run, tx } from '@/core/db';
import { findDuplicateContacts, findOrCreateOrg, type DuplicateHit } from '@/core/data';
import { ORG_TYPES, type OrgType } from '@/core/constants';
import { normalizeOrgName, normalizePersonName, phoneDigits } from '@/core/normalize';

export type ContactFormState = { error?: string; duplicates?: DuplicateHit[] } | null;

export async function saveContactAction(fd: FormData): Promise<ContactFormState> {
  const user = await requireUser();
  const id = Number(fd.get('id')) || null;
  const name = String(fd.get('name') ?? '').trim();
  const role = String(fd.get('role') ?? '').trim();
  const orgName = String(fd.get('org') ?? '').trim();
  const orgTypeRaw = String(fd.get('orgType') ?? 'other');
  const orgType: OrgType = orgTypeRaw in ORG_TYPES ? (orgTypeRaw as OrgType) : 'other';
  const assistantId = Number(fd.get('assistantId')) || null;
  const notes = String(fd.get('notes') ?? '').trim();
  const phoneNumbers = fd.getAll('phone').map(String);
  const phoneLabels = fd.getAll('phoneLabel').map(String);
  const phones = phoneNumbers
    .map((n, i) => ({ number: n.trim(), label: (phoneLabels[i] ?? '').trim() }))
    .filter((p) => p.number);
  const emailValues = fd.getAll('email').map(String);
  const emailLabels = fd.getAll('emailLabel').map(String);
  const emails = emailValues
    .map((e, i) => ({ email: e.trim(), label: (emailLabels[i] ?? '').trim() }))
    .filter((e) => e.email);

  if (!name) return { error: 'צריך למלא שם' };
  if (assistantId && assistantId === id) return { error: 'איש קשר לא יכול להיות המזכיר/ה של עצמו' };

  if (fd.get('confirmDuplicate') !== '1') {
    const duplicates = findDuplicateContacts(
      { name, phones: phones.map((p) => p.number), emails: emails.map((e) => e.email) },
      id ?? undefined,
    );
    if (duplicates.length) return { duplicates };
  }

  const savedId = tx(() => {
    const orgId = findOrCreateOrg(orgName, orgType);
    let cid = id;
    if (cid) {
      run(
        `UPDATE contacts SET name=?, role=?, organization_id=?, assistant_id=?, notes=?, norm=?,
         updated_at=datetime('now','localtime') WHERE id=?`,
        name, role, orgId, assistantId, notes, normalizePersonName(name), cid,
      );
      run('DELETE FROM contact_phones WHERE contact_id = ?', cid);
      run('DELETE FROM contact_emails WHERE contact_id = ?', cid);
    } else {
      cid = run(
        'INSERT INTO contacts (name, role, organization_id, assistant_id, notes, norm, created_by) VALUES (?,?,?,?,?,?,?)',
        name, role, orgId, assistantId, notes, normalizePersonName(name), user.id,
      ).id;
    }
    for (const p of phones)
      run('INSERT INTO contact_phones (contact_id, number, digits, label) VALUES (?,?,?,?)', cid, p.number, phoneDigits(p.number), p.label);
    for (const e of emails) run('INSERT INTO contact_emails (contact_id, email, label) VALUES (?,?,?)', cid, e.email, e.label);
    return cid;
  });
  revalidatePath('/', 'layout');
  redirect(`/contacts/${savedId}`);
}

export async function deleteContactAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id'));
  // Calls stay in the log (contact_id becomes empty) so history is never lost.
  run(
    `UPDATE calls SET organization_id = COALESCE(organization_id, (SELECT organization_id FROM contacts WHERE id = ?)),
       spoke_with = CASE WHEN spoke_with = '' THEN (SELECT name FROM contacts WHERE id = ?) ELSE spoke_with END
     WHERE contact_id = ?`,
    id, id, id,
  );
  run('DELETE FROM contacts WHERE id = ?', id);
  revalidatePath('/', 'layout');
  redirect('/contacts');
}

// ---------- organizations ----------

export async function saveOrgAction(fd: FormData) {
  await requireUser();
  const id = Number(fd.get('id')) || null;
  const name = String(fd.get('name') ?? '').trim();
  const typeRaw = String(fd.get('type') ?? 'other');
  const type = typeRaw in ORG_TYPES ? typeRaw : 'other';
  const aliases = String(fd.get('aliases') ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
  const notes = String(fd.get('notes') ?? '').trim();
  if (!name) return;
  if (id) {
    run('UPDATE organizations SET name=?, type=?, aliases=?, notes=?, norm=? WHERE id=?', name, type, aliases, notes, normalizeOrgName(name), id);
  } else {
    findOrCreateOrg(name, type as OrgType);
  }
  revalidatePath('/', 'layout');
}

/** Move everything from `sourceId` into `targetId` and delete the source. */
export async function mergeOrgsAction(fd: FormData) {
  await requireUser();
  const sourceId = Number(fd.get('sourceId'));
  const targetId = Number(fd.get('targetId'));
  if (!sourceId || !targetId || sourceId === targetId) return;
  tx(() => {
    run(
      `UPDATE organizations SET aliases = trim(aliases || char(10) || (SELECT name FROM organizations WHERE id = ?)
         || CASE WHEN (SELECT aliases FROM organizations WHERE id = ?) <> '' THEN char(10) || (SELECT aliases FROM organizations WHERE id = ?) ELSE '' END, char(10))
       WHERE id = ?`,
      sourceId, sourceId, sourceId, targetId,
    );
    run('UPDATE contacts SET organization_id = ? WHERE organization_id = ?', targetId, sourceId);
    run('UPDATE calls SET organization_id = ? WHERE organization_id = ?', targetId, sourceId);
    run('DELETE FROM organizations WHERE id = ?', sourceId);
  });
  revalidatePath('/', 'layout');
  redirect(`/organizations/${targetId}`);
}

export async function deleteOrgAction(fd: FormData) {
  await requireUser();
  run('DELETE FROM organizations WHERE id = ?', Number(fd.get('id')));
  revalidatePath('/', 'layout');
  redirect('/organizations');
}
