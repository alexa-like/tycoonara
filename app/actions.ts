'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { AVATARS, validUsername } from '@/lib/rules.mjs';
export type FormState = { error?: string; message?: string };
function siteUrl() {
  const url = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
  return new URL(url).origin;
}
function field(form: FormData, key: string) { return String(form.get(key) ?? '').trim(); }
export async function authenticate(_state: FormState, form: FormData): Promise<FormState> {
  const mode = field(form, 'mode');
  const email = field(form, 'email');
  const password = String(form.get('password') ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: 'Enter a valid email address.' };
  if (!['signin','signup','reset','resend'].includes(mode)) return { error: 'Choose a valid action.' };
  const supabase = await createClient();
  if (mode === 'reset') {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password` });
    if (error) return { error: 'Unable to send a reset link. Please wait a moment and try again.' };
    return { message: 'If an account exists, a password reset link is on its way. Check your inbox and spam folder.' };
  }
  if (mode === 'resend') {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` } });
    if (error) return { error: 'Unable to resend right now. Please wait a moment and try again.' };
    return { message: 'If verification is needed, a new link is on its way.' };
  }
  if (!password || password.length > 128 || (mode === 'signup' && password.length < 12)) return { error: 'Use a password between 12 and 128 characters when creating an account.' };
  if (mode === 'signup') {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` } });
    if (error) return { error: 'Unable to create an account. Please try again later or sign in if you already registered.' };
    return { message: 'Check your email to verify your account, then return to choose your founder name.' };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Could not sign in. Check your credentials and verify your email first.' };
  redirect('/game');
}
export async function completeOnboarding(_state: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const username = field(form, 'username');
  const avatar = field(form, 'avatar');
  if (!validUsername(username)) return { error: 'Use 3–20 letters, digits or underscores, starting with a letter.' };
  if (!AVATARS.includes(avatar)) return { error: 'Choose one of the four founder portraits.' };
  const { error } = await supabase.rpc('bootstrap_player', { chosen_username: username, chosen_avatar: avatar });
  if (error) return { error: error.code === '23505' ? 'That founder name is already taken. Try another.' : 'Unable to finish onboarding. Please retry; your grant will never be duplicated.' };
  redirect('/game');
}
export async function updatePassword(_state: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const password = String(form.get('password') ?? '');
  if (password.length < 12 || password.length > 128) return { error: 'Use 12–128 characters.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'Unable to update your password. Request a fresh link and try again.' };
  await supabase.auth.signOut();
  redirect('/login?notice=password');
}
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Sign-out failed. Please retry.');
  redirect('/');
}
