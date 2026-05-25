import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';
import '@/styles/globals.css';

// Fonts
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

// Metadata
export const metadata: Metadata = {
  title: {
    default: 'FotoPro — Galeria de Fotografias Profissionais',
    template: '%s | FotoPro',
  },
  description:
    'Plataforma premium de entrega de fotografias profissionais. Visualize, baixe e compartilhe suas fotos com segurança.',
  keywords: ['fotografia', 'galeria', 'fotos profissionais', 'download seguro'],
  authors: [{ name: 'FotoPro' }],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/icons/icon-32x32.png',  sizes: '32x32',  type: 'image/png' },
      { url: '/icons/icon-96x96.png',  sizes: '96x96',  type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/icon-512x512.png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FotoPro',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f0f10' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Layout
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body
        className="font-body antialiased selection:bg-gold-500/20 selection:text-gold-400"
        style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-card)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-card-border)',
                borderRadius: '12px',
                fontFamily: 'var(--font-dm-sans)',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#d4a847', secondary: 'var(--color-bg)' },
              },
              error: {
                iconTheme: { primary: '#f87171', secondary: 'var(--color-bg)' },
              },
            }}
          />
        </ThemeProvider>

        {/* PWA — registra o Service Worker após o carregamento da página */}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}