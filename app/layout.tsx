import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'Zynq — AI Study Assistant',
  description: 'Graba clases, sube imágenes y genera guías de estudio con IA.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${inter.variable}`}>
      <body className="h-full">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
