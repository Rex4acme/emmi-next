// app/layout.tsx — Root Layout
// Wraps every page in the app. Sets fonts, metadata, and global CSS.
// AuthProvider ensures the user session is available everywhere.

import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// ── Google Fonts ───────────────────────────────────────────────
// next/font loads fonts at build time — no layout shift, no external requests

// Syne — display/heading font (bold, distinctive)
const fontDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '800'],
});

// DM Sans — body font (clean, readable)
const fontBody = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
});

// JetBrains Mono — monospace for IDs, values, fault codes
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

// ── Page Metadata ──────────────────────────────────────────────
export const metadata: Metadata = {
  title:       'EMMI — Electrical Maintenance Intelligence',
  description: 'Personal electrical equipment management, fault tracking, and AI-powered troubleshooting logbook.',
  manifest:    '/manifest.json', // PWA manifest
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'EMMI',
  },
};

// ── Viewport / PWA ────────────────────────────────────────────
export const viewport: Viewport = {
  themeColor:           '#f0a500', // Amber — shows in mobile browser toolbar
  width:                'device-width',
  initialScale:         1,
  viewportFit:          'cover',   // Allow content under notch on iPhone
};

// ── Root Layout ────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32"/>
        <link rel="apple-touch-icon" href="/icons/icon-192.png"/>
      </head>
      <body className="bg-surface text-text font-body antialiased">
        {/* All pages render here */}
        {children}
      </body>
    </html>
  );
}
