import type { Metadata, Viewport } from 'next';
import { siteName } from '@/core/db';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const name = siteName();
  return { title: name, applicationName: name, appleWebApp: { title: name }, robots: { index: false, follow: false } };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
