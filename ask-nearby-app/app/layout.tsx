import './globals.css'

export const metadata = {
  title: 'Near By',
  description: 'Ask nearby. Get real answers.',
  manifest: '/manifest.webmanifest',
}

export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
