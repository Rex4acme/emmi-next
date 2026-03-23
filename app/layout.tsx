import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans, JetBrains_Mono } from 'next/font/google';
import PWAProvider from '@/components/ui/PWAProvider';
import './globals.css';

const fontDisplay = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['400','600','700','800'] });
const fontBody    = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['300','400','500','600'] });
const fontMono    = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400','500','600'] });

export const metadata: Metadata = {
  title: 'EMMI — Electrical Maintenance Intelligence',
  description: 'Professional electrical maintenance logbook for industrial plants.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable:       true,
    statusBarStyle: 'black-translucent',
    title:         'EMMI',
  },
  icons: {
    icon:  '/icons/favicon-32.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor:     '#f0a500',
  width:          'device-width',
  initialScale:   1,
  viewportFit:    'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body className="antialiased">
        {children}
        <PWAProvider/>
      </body>
    </html>
  );
}
