import './globals.css'

export const metadata = {
  title: 'AI Image Generator - Qwen Vision',
  description: 'Professional AI Image Generation powered by Qwen Vision AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
