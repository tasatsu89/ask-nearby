import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Ask Nearby',
  description: 'Live answers from people who are actually there.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ask Nearby'
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url:'/icon-192.png', sizes:'192x192', type:'image/png' },
      { url:'/icon-512.png', sizes:'512x512', type:'image/png' }
    ]
  }
}

export const viewport: Viewport = {
  themeColor: '#6657e8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
