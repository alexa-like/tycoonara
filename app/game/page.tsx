import { redirect } from 'next/navigation';
import { getPlayer } from '@/lib/auth';
import { District } from '@/components/district';
export const dynamic = 'force-dynamic';
export default async function Game() {
  const { supabase, player } = await getPlayer();
  if (!player) redirect('/onboarding');
  const { data: wallet, error } = await supabase.from('wallets').select('balance_subunits').eq('player_id',player.id).single();
  if (error || !wallet) throw new Error('Unable to load your founding balance. Please retry.');
  return <main id="main" className="game-layout"><District player={player} balance={Number(wallet.balance_subunits)} /></main>;
}
