import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import { WalletProvider } from '@/components/WalletProvider';
import './globals.css';

// Geist (UI + display) and Geist Mono (numbers) ship as npm packages, so builds
// never depend on Google Fonts being reachable. Instrument Serif supplies the
// italic accent words.

export const metadata: Metadata = {
  title:       'HERMES — Market Formation for New Onchain Assets',
  description: 'HERMES helps token creators and launch teams design, simulate, and validate market formation strategies before deploying on Meteora.',
  icons: {
    icon:     '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title:       'HERMES — Market Formation for New Onchain Assets',
    description: 'Design, simulate, and validate your market formation strategy before deploying real capital on Meteora.',
    url:         'https://hermes-meteora.vercel.app',
    siteName:    'HERMES',
    type:        'website',
  },
  twitter: {
    card:        'summary',
    title:       'HERMES — Market Formation for New Onchain Assets',
    description: 'Design, simulate, and validate your market formation strategy before deploying real capital on Meteora.',
  },
};

// themeColor must be in viewport export in Next.js 15 (not metadata)
export const viewport: Viewport = {
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ colorScheme: 'light' }}
    >
      <body suppressHydrationWarning>
        {/* Atmosphere: one soft aurora wash behind every page */}
        <div className="aurora-wash" aria-hidden="true" />
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
