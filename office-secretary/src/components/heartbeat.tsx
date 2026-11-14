'use client';

import { useEffect } from 'react';

const TARGET = { locked: '/locked', 'logged-out': '/login', 'no-drive': '/no-drive' } as Record<string, string>;

export function Heartbeat() {
  useEffect(() => {
    const beat = async () => {
      try {
        const r = await fetch('/api/heartbeat', { cache: 'no-store' });
        const { state } = await r.json();
        if (TARGET[state]) window.location.href = TARGET[state];
      } catch {
        // server closed – nothing to do
      }
    };
    const t = setInterval(beat, 30_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
