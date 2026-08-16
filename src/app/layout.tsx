import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Store } from '@/components/Store';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'focusBet — UFC play-money book',
  description: 'Personal play-money sportsbook for UFC cards.',
};

export const viewport: Viewport = {
  themeColor: '#07090c',
  width: 'device-width',
  initialScale: 1,
  // Draw under the gesture bar; padding below uses the safe-area insets.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Store>
          <Shell>{children}</Shell>
        </Store>
      </body>
    </html>
  );
}
