/** Helpers for comparing names/phones despite spelling variations ("עמק חפר" vs "מ.א. עמק חפר"). */

const QUOTES = /["'״׳`’]/g;

export function normalizeText(s: string): string {
  return s.replace(QUOTES, '').replace(/[.,\-–_()\[\]/\\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const NAME_PREFIXES = ['מר', 'גב', 'גברת', 'דר', 'עוד', 'רוח', 'פרופ', 'הרב'];

export function normalizePersonName(s: string): string {
  const words = normalizeText(s).split(' ').filter(Boolean);
  while (words.length > 1 && NAME_PREFIXES.includes(words[0])) words.shift();
  return words.join(' ');
}

// Order matters: longer prefixes first.
const ORG_PREFIXES = [
  'מועצה אזורית',
  'מועצה מקומית',
  'המועצה האזורית',
  'המועצה המקומית',
  'עיריית',
  'עירית',
  'עירייה',
  'מ א',
  'מא',
  'מ מ',
  'ממ',
  'מועצת',
];

export function normalizeOrgName(s: string): string {
  let n = normalizeText(s);
  for (const p of ORG_PREFIXES) {
    if (n.startsWith(p + ' ')) {
      n = n.slice(p.length + 1);
      break;
    }
  }
  return n.replace(/\s+/g, '');
}

export function phoneDigits(s: string): string {
  let d = s.replace(/^tel:/i, '').replace(/\D/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  // Numbers saved as numbers in Excel lose their leading zero (e.g. 545551234).
  if ((d.length === 8 || d.length === 9) && !d.startsWith('0')) d = '0' + d;
  return d;
}

export function formatPhone(s: string): string {
  const d = phoneDigits(s);
  if (/^05\d{8}$/.test(d) || /^07\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (/^0[2-489]\d{7}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return s.trim();
}
