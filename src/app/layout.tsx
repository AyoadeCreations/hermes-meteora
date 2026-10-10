import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { WalletProvider } from '@/components/WalletProvider';
import './globals.css';

const fontInter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  weight:   ['400', '500', '600', '700'],
});

const fontMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-jetbrains',
  display:  'swap',
  weight:   ['400', '500'],
});

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
  themeColor: '#020203',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontInter.variable} ${fontMono.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body suppressHydrationWarning>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
