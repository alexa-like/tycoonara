import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  if (!user.email_confirmed_at) redirect('/login?notice=verify');
  return { supabase, user };
}
export async function getPlayer() {
  const { supabase, user } = await requireUser();
  const { data: player, error } = await supabase.from('players').select('id,username,avatar,level,xp,reputation').eq('id', user.id).maybeSingle();
  if (error) throw new Error('Unable to load your founder profile. Please retry.');
  return { supabase, user, player };
}
