export const DIRECTIONS = {
  out: 'פנינו אליהם',
  in: 'פנו אלינו',
} as const;
export type Direction = keyof typeof DIRECTIONS;

export const RESULTS = {
  no_answer: { label: 'אין מענה', short: 'א"מ', color: 'bg-slate-100 text-slate-700 ring-slate-300' },
  left_message: { label: 'השארתי הודעה', short: 'הודעה', color: 'bg-amber-50 text-amber-800 ring-amber-300' },
  spoke: { label: 'דיברתי', short: 'דיברתי', color: 'bg-sky-50 text-sky-800 ring-sky-300' },
  meeting_set: { label: 'נקבעה פגישה', short: 'פגישה', color: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  refused: { label: 'סירוב', short: 'סירוב', color: 'bg-rose-50 text-rose-800 ring-rose-300' },
} as const;
export type Result = keyof typeof RESULTS;

/** Results that usually mean the call still needs follow-up. */
export const OPEN_BY_DEFAULT: Result[] = ['no_answer', 'left_message', 'spoke'];

export const ORG_TYPES = {
  regional: 'מועצה אזורית',
  city: 'עירייה',
  local: 'מועצה מקומית',
  gov: 'גוף ממשלתי',
  other: 'אחר',
} as const;
export type OrgType = keyof typeof ORG_TYPES;

export const ROLE_SUGGESTIONS = [
  'ראש מועצה',
  'ראש עירייה',
  'סגן ראש מועצה',
  'גזבר/ית',
  'מנכ"ל/ית',
  'חשב/ת',
  'מזכירה',
  'מנהלת לשכה',
  'מהנדס/ת',
  'יועמ"ש',
  'מוקד',
];

export const PHONE_LABELS = ['נייד', 'לשכה', 'משרד', 'שלוחה', 'פקס', 'אחר'];

export const SHIFT_LABELS = { morning: 'משמרת בוקר', afternoon: 'משמרת צהריים' } as const;

/** Meeting-tracking states, in kanban column order. */
export const MEETING_STATES = {
  retry_tomorrow: { label: 'לנסות שוב מחר', color: 'bg-sky-50 text-sky-800 ring-sky-300', col: 'border-t-sky-400' },
  retry_next_week: { label: 'לנסות שוב שבוע הבא', color: 'bg-indigo-50 text-indigo-800 ring-indigo-300', col: 'border-t-indigo-400' },
  retry_on_date: { label: 'לנסות שוב בתאריך', color: 'bg-violet-50 text-violet-800 ring-violet-300', col: 'border-t-violet-400' },
  they_call_back: { label: 'הם יחזרו אלינו', color: 'bg-teal-50 text-teal-800 ring-teal-300', col: 'border-t-teal-400' },
  i_owe_answer: { label: 'אני צריכה לחזור אליהם עם תשובה', color: 'bg-amber-50 text-amber-800 ring-amber-300', col: 'border-t-amber-400' },
  meeting_set: { label: 'נקבעה פגישה', color: 'bg-emerald-50 text-emerald-800 ring-emerald-300', col: 'border-t-emerald-500' },
  nothing: { label: 'אין מה לעשות עם זה', color: 'bg-slate-100 text-slate-600 ring-slate-300', col: 'border-t-slate-300' },
} as const;
export type MeetingState = keyof typeof MEETING_STATES;

/** States that are "closed" – no follow-up call needed. */
export const NO_FOLLOW_UP: MeetingState[] = ['meeting_set', 'nothing'];

export const DEFAULT_SUBJECT = 'חלף היטל השבחה';
export const THEY_CALL_BACK_DAYS = 10;
export const EARLIEST_MEETING_TIME = '12:00';
