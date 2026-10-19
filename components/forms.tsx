'use client';
import { useActionState, useState } from 'react';
import { authenticate, completeOnboarding, updatePassword } from '@/app/actions';
import { AVATARS } from '@/lib/rules.mjs';
import { Avatar } from './portrait';
function Feedback({ state }: { state: { error?: string; message?: string } }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="feedback error">{state.error}</p>}{state.message && <p role="status" className="feedback">{state.message}</p>}</div>;
}
export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'resend'>('signin');
  const [state, action, pending] = useActionState(authenticate, {});
  return <>
    <div className="tabs" aria-label="Account action">{([['signin','Sign in'],['signup','Create account'],['reset','Reset password'],['resend','Resend verification']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>
    <form action={action} className="stack">
      <input type="hidden" name="mode" value={mode} />
      <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      {['signin','signup'].includes(mode) && <><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : 1} maxLength={128} required />{mode === 'signup' && <small>At least 12 characters. Your account starts after email verification.</small>}</>}
      <Feedback state={state} />
      <button className="primary" disabled={pending}>{pending ? 'Please wait…' : ({ signin:'Enter Tycoonara', signup:'Start your story', reset:'Send reset link', resend:'Send verification link' }[mode])}</button>
    </form>
  </>;
}
export function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, {});
  return <form action={action} className="stack">
    <label htmlFor="username">Your founder name</label><input id="username" name="username" autoComplete="nickname" minLength={3} maxLength={20} pattern="[A-Za-z][A-Za-z0-9_]{2,19}" aria-describedby="name-help" required />
    <small id="name-help">3–20 letters, digits or underscores. Start with a letter. Names ignore capitalization and are permanent in Stage 1.</small>
    <fieldset><legend>Choose your portrait</legend><div className="portraits">{AVATARS.map((avatar, index) => <label key={avatar} className="portrait-choice"><input type="radio" name="avatar" value={avatar} defaultChecked={index === 0} /><Avatar preset={avatar} /><span>{avatar}</span></label>)}</div></fieldset>
    <p className="grant">Your welcome: <strong>500 EC</strong> · Level 1 · Reputation 50<br /><small>A one-time founding grant. Your money is safe while the district prepares to open.</small></p>
    <Feedback state={state} /><button className="primary" disabled={pending}>{pending ? 'Preparing your headquarters…' : 'Make it official →'}</button>
  </form>;
}
export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return <form action={action} className="stack"><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><Feedback state={state} /><button className="primary" disabled={pending}>{pending ? 'Saving…' : 'Save password and sign out'}</button></form>;
}
