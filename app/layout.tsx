import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme';
import './globals.css';
import './district.css';
import './auth.css';
export const metadata: Metadata = { title: 'Tycoonara — Build your own tomorrow', description: 'A new district. A fresh start. Your business story begins in Tycoonara.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem('tycoonara-theme')==='dark'?'dark':'light'}catch{}` }} /><a href="#main" className="skip">Skip to content</a><header className="topbar"><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">T</span>tycoonara<span className="stage">FOUNDERS EDITION</span></Link><ThemeToggle /></header>{children}<footer className="footer">An original world. A little ambition. A lot of possibility. <span>Tycoonara · Stage 1</span></footer></body></html>;
}
