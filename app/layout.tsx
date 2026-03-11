import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fontDisplay = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['400','600','700','800'] });
const fontBody    = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['300','400','500','600'] });
const fontMono    = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400','500','600'] });

export const metadata: Metadata = {
  title:       'EMMI — Electrical Maintenance Intelligence',
  description: 'Personal electrical equipment management and fault tracking logbook.',
  manifest:    '/manifest.json',
};

export const viewport: Viewport = {
  themeColor:   '#f0a500',
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
