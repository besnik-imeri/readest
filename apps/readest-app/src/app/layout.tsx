import * as React from 'react';
import type { Metadata, Viewport } from 'next';
import { ViewTransitions } from 'next-view-transitions';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';
import { STORYBORED_LOGO_ASSETS } from '@/integrations/storybored/StoryBoredLogo';

import '../styles/globals.css';

const url = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://storybored.com/';
const title = 'StoryBored — Never be bored by a story again';
const description =
  'StoryBored turns selected passages into cozy, imaginative scene visuals without pulling readers away from the book.';
const previewImage = STORYBORED_LOGO_ASSETS.appIcon;

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: title,
    template: '%s | StoryBored',
  },
  description,
  generator: 'Next.js',
  manifest: '/manifest.json',
  keywords: ['storybored', 'epub', 'pdf', 'ebook', 'reader', 'visual reading', 'pwa'],
  authors: [
    {
      name: 'StoryBored',
    },
  ],
  icons: {
    icon: [{ url: STORYBORED_LOGO_ASSETS.favicon, type: 'image/svg+xml' }],
    apple: [{ url: STORYBORED_LOGO_ASSETS.appIcon, type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    title: 'StoryBored',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    url,
    title,
    description,
    images: [previewImage],
  },
  twitter: {
    card: 'summary',
    title,
    description,
    images: [previewImage],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'twitter:domain': 'storybored.com',
    'twitter:url': url,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      className={process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri' ? 'edge-to-edge' : ''}
    >
      <body>
        <ViewTransitions>
          <EnvProvider>
            <Providers>{children}</Providers>
          </EnvProvider>
        </ViewTransitions>
      </body>
    </html>
  );
}
