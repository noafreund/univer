'use client';

import { useState } from 'react';
import type { ContactOption } from '@/core/data';
import { ContactPicker } from './contact-picker';

/** ContactPicker for plain (server) forms: keeps its own state and submits a hidden field. */
export function ContactPickerField({ contacts, name, initial, placeholder }: { contacts: ContactOption[]; name: string; initial?: number | null; placeholder?: string }) {
  const [id, setId] = useState<number | null>(initial ?? null);
  return <ContactPicker contacts={contacts} value={id} onChange={setId} name={name} placeholder={placeholder} />;
}
