'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { authenticate, completeOnboarding, updatePassword } from '@/app/actions';
import { AVATARS } from '@/lib/rules.mjs';
import { Avatar } from './portrait';
function Feedback({ state }: { state: { error?: string; message?: string } }) {
  return <div aria-live="polite">{state.error && <p role="alert" className="feedback error">{state.error}</p>}{state.message && <p role="status" className="feedback">{state.message}</p>}</div>;
}
type AuthMode = 'signin' | 'signup' | 'reset' | 'resend';
const AUTH_COPY = {
  signin: {title:'Welcome back, founder.',description:'Your district is ready when you are.',submit:'Enter Tycoonara'},
  signup: {title:'Make room for ambition.',description:'Create your account. Your founder story comes next.',submit:'Start your story'},
  reset: {title:'Let’s get you back in.',description:'We’ll email you a secure link to reset your password.',submit:'Send reset link'},
  resend: {title:'Your first step: verify.',description:'Request a fresh verification link for your account.',submit:'Send verification link'},
};
function PasswordField({id,label,newPassword=false,disabled=false,onForgot}: {id:string;label:string;newPassword?:boolean;disabled?:boolean;onForgot?:()=>void}) {
  const [visible,setVisible] = useState(false);
  return <div className="auth-field"><div className="auth-label-row"><label htmlFor={id}>{label}</label>{onForgot&&<button className="auth-text-link forgot-link" type="button" onClick={onForgot} disabled={disabled}>Forgot password?</button>}</div><div className="password-input"><input id={id} name="password" type={visible?'text':'password'} autoComplete={newPassword?'new-password':'current-password'} minLength={newPassword?12:1} maxLength={128} required disabled={disabled} aria-describedby={newPassword?`${id}-help`:undefined}/><button type="button" className="password-toggle" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(!visible)} disabled={disabled}>{visible?'Hide':'Show'}</button></div>{newPassword&&<small id={`${id}-help`}>Use 12–128 characters. A few unexpected words work well.</small>}</div>;
}
export function AuthForm({notice}: {notice?:string}) {
  const [mode,setMode] = useState<AuthMode>(notice==='verify'||notice==='expired'?'resend':'signin');
  const [email,setEmail] = useState('');
  const [currentNotice,setNotice] = useState(notice);
  const [moved,setMoved] = useState(false);
  const [step,setStep] = useState(0);
  function changeMode(next:AuthMode) {setMode(next);setNotice(undefined);setMoved(true);setStep(value=>value+1);}
  return <AuthStep key={`${mode}-${step}`} mode={mode} email={email} setEmail={setEmail} changeMode={changeMode} notice={currentNotice} focusHeading={moved}/>;
}
function AuthStep({mode,email,setEmail,changeMode,notice,focusHeading}: {mode:AuthMode;email:string;setEmail:(value:string)=>void;changeMode:(mode:AuthMode)=>void;notice?:string;focusHeading:boolean}) {
  const [state,action,pending] = useActionState(authenticate, {});
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(focusHeading)heading.current?.focus();},[focusHeading]);
  useEffect(()=>{if(state.error||state.message)feedback.current?.focus();},[state]);
  const sent = Boolean(state.message);
  const signupSent = mode==='signup'&&sent;
  const copy = AUTH_COPY[mode];
  const notices:Record<string,string> = {verify:'Check your inbox and verify your email to continue.',expired:'That link has expired or is invalid. Request a fresh link below.',password:'Password updated. Sign in with your new password.'};
  return <>
    {mode==='signin'||mode==='signup'?<div className="auth-mode-switch" role="group" aria-label="Account access"><button type="button" aria-pressed={mode==='signin'} onClick={()=>changeMode('signin')} disabled={pending}>Sign in</button><button type="button" aria-pressed={mode==='signup'} onClick={()=>changeMode('signup')} disabled={pending}>Create account</button></div>:<button className="auth-back" type="button" onClick={()=>changeMode('signin')} disabled={pending}>← Back to sign in</button>}
    <div className="auth-form-heading"><span className="eyebrow">{signupSent?'YOUR INVITATION IS ON ITS WAY':mode==='reset'?'ACCOUNT RECOVERY':mode==='resend'?'EMAIL VERIFICATION':'WELCOME TO TYCOONARA'}</span><h2 ref={heading} tabIndex={-1}>{signupSent?'Check your inbox.':sent?'A link is on its way.':copy.title}</h2><p>{signupSent?'One small step before your big beginning.':copy.description}</p></div>
    {notice&&notices[notice]&&<p role="status" className="auth-notice">{notices[notice]}</p>}
    <form action={action} className="auth-form" aria-label={mode==='signin'?'Sign in':mode==='signup'?'Create account':mode==='reset'?'Reset password':'Email verification'} aria-busy={pending}>
      <input type="hidden" name="mode" value={mode}/>
      {!sent&&<>
        <div className="auth-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} disabled={pending}/></div>
        {(mode==='signin'||mode==='signup')&&<><PasswordField id="password" label="Password" newPassword={mode==='signup'} disabled={pending} onForgot={mode==='signin'?()=>changeMode('reset'):undefined}/></>}
      </>}
      <div ref={feedback} tabIndex={-1} className="auth-feedback" aria-live="polite" aria-atomic="true">{state.error&&<p role="alert" className="feedback error">{state.error}</p>}{state.message&&<div className="feedback auth-success"><span className="auth-success-mark" aria-hidden="true">✓</span><p role="status">{state.message}</p><p className="auth-email-destination">{email}</p><small>Check spam too. Open the link in this browser to continue safely.</small></div>}</div>
      {!sent&&<button className="primary auth-submit" disabled={pending}>{pending?'Please wait…':copy.submit}<span aria-hidden="true">→</span></button>}
      {mode==='signup'&&!sent&&<p className="auth-form-note">No payment needed. Verify your email before choosing your founder name.</p>}
    </form>
    {sent?<div className="auth-followup"><p>{signupSent?'Already verified?':'Ready for the next step?'}</p><button className="primary auth-submit" type="button" onClick={()=>changeMode('signin')}>Back to sign in</button>{mode!=='reset'&&<button className="auth-text-link" type="button" onClick={()=>changeMode('resend')}>Resend verification</button>}<button className="auth-text-link" type="button" onClick={()=>changeMode(mode==='reset'?'reset':'resend')}>Use another email address</button></div>:<div className="auth-help"><p>{mode==='signin'?'Waiting for your invitation?':mode==='signup'?'Already registered but not verified?':mode==='reset'?'Need to verify your email instead?':'Remembered your password?'}</p><button className="auth-text-link" type="button" onClick={()=>changeMode(mode==='resend'?'signin':'resend')} disabled={pending}>{mode==='resend'?'Sign in to your account':'Resend verification'}</button></div>}
    <p className="auth-security"><span aria-hidden="true">◇</span> A secure account for a world of possibility.</p>
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
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.error)feedback.current?.focus();},[state]);
  return <>
    <Link className="auth-back" href="/login">← Back to sign in</Link>
    <div className="auth-form-heading"><span className="eyebrow">A SAFER NEXT CHAPTER</span><h2>Choose a new password.</h2><p>Make it memorable for you, hard to guess for anyone else.</p></div>
    <form action={action} className="auth-form" aria-label="Update password" aria-busy={pending}><PasswordField id="new-password" label="New password" newPassword disabled={pending}/><div ref={feedback} tabIndex={-1} className="auth-feedback"><Feedback state={state}/></div><button className="primary auth-submit" disabled={pending}>{pending?'Saving…':'Save password and sign out'}</button><p className="auth-form-note">After saving, sign in again with your new password. Your founder profile and district stay safe.</p></form>
    <p className="auth-security"><span aria-hidden="true">◇</span> Secure your account. Keep your ambition.</p>
  </>;
}
