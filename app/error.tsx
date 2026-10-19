'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="onboarding card"><h1>A small detour.</h1><p>We couldn’t load the district. Your account and grant remain safe.</p><button className="primary" onClick={reset}>Try again</button><Link href="/">Back home</Link></main>; }
