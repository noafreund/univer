import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { all, DATA_DIR, get, run, setSetting, tx } from './db';
import { findOrCreateOrg } from './data';
import { normalizeOrgName, normalizePersonName, phoneDigits } from './normalize';
import type { ParsedImport } from './importer';

const PENDING = path.join(DATA_DIR, 'import-pending.json');

export function savePending(p: ParsedImport) {
  fs.writeFileSync(PENDING, JSON.stringify(p));
}
export function loadPending(): ParsedImport | null {
  try {
    return JSON.parse(fs.readFileSync(PENDING, 'utf8')) as ParsedImport;
  } catch {
    return null;
  }
}
export function clearPending() {
  fs.rmSync(PENDING, { force: true });
}

export type Decisions = {
  /** group key → final org name */
  names: Record<string, string>;
  /** group keys the user chose NOT to merge (each spelling becomes its own org) */
  split: string[];
  /** accepted merge suggestions "a|b" */
  merges: string[];
};

/** Variant name → final org name, after applying the user's choices. */
export function resolveOrgs(p: ParsedImport, d: Decisions): Map<string, string> {
  // union-find over group keys for accepted suggestions
  const parent = new Map<string, string>();
  const find = (k: string): string => (parent.get(k) && parent.get(k) !== k ? find(parent.get(k)!) : k);
  for (const g of p.orgGroups) parent.set(g.key, g.key);
  for (const m of d.merges) {
    const [a, b] = m.split('|');
    if (parent.has(a) && parent.has(b)) parent.set(find(b), find(a));
  }
  const out = new Map<string, string>();
  for (const g of p.orgGroups) {
    const root = find(g.key);
    const rootGroup = p.orgGroups.find((x) => x.key === root)!;
    const finalName = (d.names[root] || rootGroup.suggested).trim();
    for (const v of g.variants) out.set(v.name, d.split.includes(g.key) && root === g.key ? v.name : finalName);
  }
  return out;
}

type ContactAgg = {
  name: string;
  orgName: string;
  roles: Map<string, number>;
  phones: Map<string, { number: string; label: string }>;
  emails: Set<string>;
};

export function commitImport(p: ParsedImport, d: Decisions, userId: number) {
  const orgOf = resolveOrgs(p, d);
  const stats = { orgs: 0, contacts: 0, calls: 0, meetings: 0, appeals: 0, publications: 0, procedures: 0, phones: 0, docs: 0, notes: 0, tasks: 0 };

  return tx(() => {
    const orgIds = new Map<string, number | null>();
    const orgId = (raw: string) => {
      const name = orgOf.get(raw.trim()) ?? raw.trim();
      if (!name) return null;
      if (!orgIds.has(name)) {
        const before = get<{ n: number }>('SELECT COUNT(*) n FROM organizations')!.n;
        const id = findOrCreateOrg(name);
        if (get<{ n: number }>('SELECT COUNT(*) n FROM organizations')!.n > before) stats.orgs++;
        orgIds.set(name, id);
      }
      return orgIds.get(name)!;
    };
    // remember every spelling as an alias, so future typing finds the same org
    for (const [variant, final] of orgOf) {
      const id = orgId(variant);
      if (!id || variant === final) continue;
      const o = get<{ aliases: string; name: string }>('SELECT aliases, name FROM organizations WHERE id = ?', id)!;
      const list = o.aliases ? o.aliases.split('\n') : [];
      if (variant !== o.name && !list.includes(variant)) run('UPDATE organizations SET aliases = ? WHERE id = ?', [...list, variant].join('\n'), id);
    }

    // ---- contacts (aggregated from all call rows + meetings) ----
    const contacts = new Map<string, ContactAgg>();
    const keyOf = (name: string, org: string) => `${normalizePersonName(name)}|${normalizeOrgName(orgOf.get(org) ?? org)}`;
    const touch = (name: string, org: string) => {
      const k = keyOf(name, org);
      if (!contacts.has(k)) contacts.set(k, { name, orgName: org, roles: new Map(), phones: new Map(), emails: new Set() });
      return contacts.get(k)!;
    };
    for (const c of p.calls) {
      if (!c.name) continue;
      const a = touch(c.name, c.org);
      if (c.role) a.roles.set(c.role, (a.roles.get(c.role) ?? 0) + 1);
      for (const ph of c.phones) {
        const dg = phoneDigits(ph.number);
        if (!a.phones.has(dg)) a.phones.set(dg, ph);
      }
      c.emails.forEach((e) => a.emails.add(e));
    }
    for (const m of p.meetings) {
      const a = touch(m.name, m.org);
      if (m.role) a.roles.set(m.role, (a.roles.get(m.role) ?? 0) + 100); // the meetings sheet has the cleanest titles
    }
    const contactIds = new Map<string, number>();
    for (const [k, a] of contacts) {
      const oid = orgId(a.orgName);
      const norm = normalizePersonName(a.name);
      const role = [...a.roles.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
      let id = get<{ id: number }>('SELECT id FROM contacts WHERE norm = ? AND organization_id IS ?', norm, oid)?.id;
      if (!id) {
        id = run('INSERT INTO contacts (name, role, organization_id, norm, created_by) VALUES (?,?,?,?,?)', a.name, role, oid, norm, userId).id;
        stats.contacts++;
      }
      const have = new Set(all<{ digits: string }>('SELECT digits FROM contact_phones WHERE contact_id = ?', id).map((r) => r.digits));
      for (const [dg, ph] of a.phones)
        if (!have.has(dg)) run('INSERT INTO contact_phones (contact_id, number, digits, label) VALUES (?,?,?,?)', id, ph.number, dg, ph.label);
      const haveE = new Set(all<{ email: string }>('SELECT lower(email) email FROM contact_emails WHERE contact_id = ?', id).map((r) => r.email));
      for (const e of a.emails) if (!haveE.has(e)) run('INSERT INTO contact_emails (contact_id, email) VALUES (?,?)', id, e);
      contactIds.set(k, id);
    }

    // ---- calls ----
    for (const c of p.calls) {
      const cid = c.name ? contactIds.get(keyOf(c.name, c.org)) ?? null : null;
      run(
        `INSERT INTO calls (occurred_at, contact_id, organization_id, spoke_with, direction, result, details, is_open)
         VALUES (?,?,?,?,?,?,?,?)`,
        `${c.date}T${c.time}`, cid, cid ? null : orgId(c.org), c.spokeWith, c.direction, c.result, c.details, c.isOpen,
      );
      stats.calls++;
    }

    // ---- meetings: one tracking item per person (latest row wins, earlier rows become history) ----
    const byContact = new Map<number, typeof p.meetings>();
    for (const m of p.meetings) {
      const cid = contactIds.get(keyOf(m.name, m.org))!;
      byContact.set(cid, [...(byContact.get(cid) ?? []), m]);
    }
    for (const [cid, rows] of byContact) {
      rows.sort((a, b) => (a.lastContact ?? '').localeCompare(b.lastContact ?? ''));
      const m = rows[rows.length - 1];
      const history = rows
        .slice(0, -1)
        .map((r) => `${r.lastContact ? r.lastContact.split('-').reverse().join('.') : ''}: ${r.statusText} (${r.stateText})`)
        .join('\n');
      for (const r of rows) {
        if (!r.assistant) continue;
        const oid = orgId(r.org);
        const norm = normalizePersonName(r.assistant.name);
        const aid =
          get<{ id: number }>('SELECT id FROM contacts WHERE norm = ? AND organization_id IS ?', norm, oid)?.id ??
          run('INSERT INTO contacts (name, role, organization_id, norm, created_by) VALUES (?,?,?,?,?)', r.assistant.name, r.assistant.role, oid, norm, userId).id;
        run('UPDATE contacts SET assistant_id = ? WHERE id = ? AND assistant_id IS NULL', aid, cid);
      }
      const deadlineRow = [...rows].reverse().find((r) => r.deadline);
      run(
        `INSERT INTO meeting_targets (contact_id, state, next_follow_up, deadline, deadline_note, status_text, notes, created_by, updated_at)
         VALUES (?,?,?,?,?,?,?,?, ?)`,
        cid, m.state, m.state === 'nothing' || m.state === 'meeting_set' ? null : m.nextFollowUp,
        deadlineRow?.deadline ?? null, deadlineRow?.deadlineNote ?? '', m.statusText,
        [m.notes, history ? `היסטוריה מהאקסל:\n${history}` : ''].filter(Boolean).join('\n\n'),
        userId, m.lastContact ? `${m.lastContact} 00:00:00` : new Date().toISOString().slice(0, 19).replace('T', ' '),
      );
      stats.meetings++;
    }

    // ---- the rest ----
    for (const a of p.appeals) {
      if (get('SELECT 1 x FROM appeal_sessions WHERE session_date = ?', a.date)) continue;
      run('INSERT INTO appeal_sessions (session_date, agenda_received, protocol_received, decisions_received) VALUES (?,?,?,?)', a.date, +a.agenda, +a.protocol, +a.decisions);
      stats.appeals++;
    }
    for (const x of p.publications) {
      if (get('SELECT 1 x FROM publications WHERE source = ? AND name = ?', x.source, x.name)) continue;
      run(
        'INSERT INTO publications (source, name, last_date, has_protocol, link, note, check_weekday) VALUES (?,?,?,?,?,?,?)',
        x.source, x.name, x.lastDate, +x.hasProtocol, x.link, x.note, x.checkWeekday,
      );
      stats.publications++;
    }
    for (const x of p.procedures) {
      if (get('SELECT 1 x FROM procedures WHERE content = ?', x.content)) continue;
      run('INSERT INTO procedures (title, category, content) VALUES (?,?,?)', x.title, x.category, x.content);
      stats.procedures++;
    }
    for (const x of p.phones) {
      if (get('SELECT 1 x FROM useful_phones WHERE number = ?', x.number)) continue;
      run('INSERT INTO useful_phones (name, number, note) VALUES (?,?,?)', x.name, x.number, x.note);
      stats.phones++;
    }
    for (const x of p.docs) {
      if (get('SELECT 1 x FROM doc_links WHERE title = ?', x.title)) continue;
      run('INSERT INTO doc_links (title, url) VALUES (?,?)', x.title, x.url);
      stats.docs++;
    }
    for (const x of p.notes) {
      run('INSERT INTO quick_notes (text, kind) VALUES (?,?)', x.text, x.kind);
      stats.notes++;
    }
    if (p.dailyTasks.length) {
      // Replace the built-in example tasks with the office's real list (only if they were never edited).
      const DEFAULTS = ['לפתוח חלון / להדליק מזגן', 'לקחת משימות מהמגירה', 'לקחת דואר מקומה 1-', 'משימה מיוחדת של יום רביעי (לעריכה בהגדרות)'];
      const current = all<{ title: string }>('SELECT title FROM daily_tasks').map((t) => t.title);
      if (current.every((t) => DEFAULTS.includes(t))) run('DELETE FROM daily_tasks');
      p.dailyTasks.forEach((t, i) => {
        if (get('SELECT 1 x FROM daily_tasks WHERE title = ?', t.title)) return;
        run('INSERT INTO daily_tasks (title, weekdays, sort) VALUES (?,?,?)', t.title, t.weekdays, i + 1);
        stats.tasks++;
      });
    }
    setSetting('imported_at', new Date().toISOString());
    return stats;
  });
}
