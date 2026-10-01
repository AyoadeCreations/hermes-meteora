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
  title:       'HERMES',
  description: 'Design the market before you launch. Objective-driven DBC configuration, simulation, and deployment on Meteora.',
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
