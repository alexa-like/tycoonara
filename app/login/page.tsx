import Link from 'next/link';
import { AuthForm } from '@/components/forms';
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const notices: Record<string,string> = { verify:'Check your inbox and verify your email to continue.', expired:'That link has expired or is invalid. Request a fresh link below.', password:'Password updated. Sign in with your new password.' };
  return <main id="main" className="auth-layout"><section className="auth-story"><span className="eyebrow">EVERY EMPIRE HAS A FIRST DAY</span><h1>Your next chapter<br />starts here.</h1><p>A headquarters to call your own. A district full of possibility. Come make your mark.</p><div className="story-stamp">500 <span>EC<br />FOUNDING GRANT</span></div><Link href="/">← Back to the district</Link></section><section className="card auth-card" aria-labelledby="login-title"><span className="eyebrow">WELCOME, FOUNDER</span><h2 id="login-title">A fresh start awaits.</h2>{notice && notices[notice] && <p role="status" className="feedback">{notices[notice]}</p>}<AuthForm /></section></main>;
}
