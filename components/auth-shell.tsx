import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({children, recovery=false}: {children:ReactNode; recovery?:boolean}) {
  return <main id="main" className="auth-shell">
    <section className="auth-intro" aria-labelledby="auth-welcome">
      <Link className="auth-home" href="/">← Back to Tycoonara</Link>
      <span className="eyebrow">YOUR WORLD, WAITING TO HAPPEN</span>
      <h1 id="auth-welcome"><span className="auth-mobile-copy">{recovery?'A fresh start.':'Your next chapter.'}</span><span className="auth-desktop-copy">{recovery?'A fresh start. Same big dreams.':'Small beginnings. Your big story.'}</span></h1>
      <p><span className="auth-mobile-copy">{recovery?'Let’s get you safely back to your district.':'A district of possibility. A place to call your own.'}</span><span className="auth-desktop-copy">{recovery?'Let’s get you safely back to your district.':'Your own headquarters. A neighborhood of possibility. Your next chapter starts here.'}</span></p>
      <div className="auth-postcard" aria-hidden="true">
        <svg viewBox="0 0 460 260" fill="none"><path d="M20 220C100 180 122 242 228 209S354 165 440 202" stroke="currentColor" strokeOpacity=".12" strokeWidth="42"/><path d="M54 216H400" stroke="currentColor" strokeOpacity=".25" strokeDasharray="8 8"/><path d="M145 205V104L230 54 315 104V205Z" fill="var(--card)" stroke="currentColor" strokeWidth="2"/><path d="m133 106 97-61 97 61Z" fill="var(--gold)" stroke="currentColor" strokeWidth="2"/><path d="M230 44V13h40l-10 12 10 11h-40" fill="currentColor"/><path d="M213 205v-44a17 17 0 0 1 34 0v44" fill="currentColor"/><path d="M165 126h25v30h-25z M270 126h25v30h-25z" fill="var(--soft)" stroke="currentColor" strokeWidth="2"/><circle cx="230" cy="112" r="13" fill="var(--soft)" stroke="currentColor" strokeWidth="2"/><path d="M230 103v10l7 4 M135 207h190 M127 214h206" stroke="currentColor" strokeWidth="2"/><path d="M86 201v-59 M369 201v-59" stroke="currentColor" strokeWidth="3"/><circle cx="86" cy="136" r="27" fill="currentColor" fillOpacity=".24"/><circle cx="369" cy="136" r="27" fill="currentColor" fillOpacity=".24"/><path d="m104 57 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z M353 61l2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="var(--gold)"/></svg>
        <span>ONE ADDRESS. ENDLESS POSSIBILITY.</span>
      </div>
      <div className="auth-founder-perk"><span aria-hidden="true">✦</span><p>{recovery?'Your founder profile stays with you.':'A little head start: 500 EC founding grant.'}<small>{recovery?'Secure your account. Keep building your story.':'Verify your email, meet your founder, find your place.'}</small></p></div>
    </section>
    <section className="auth-card card" aria-label={recovery?'Secure your account':'Founder account'}>{children}</section>
  </main>;
}
