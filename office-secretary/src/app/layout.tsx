import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'המשרד – ניהול מזכירות', robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
