import { redirect } from 'next/navigation';
import { getPlayer } from '@/lib/auth';
import { OnboardingForm } from '@/components/forms';
import { signOut } from '@/app/actions';
export const dynamic = 'force-dynamic';
export default async function Onboarding() {
  const { player } = await getPlayer();
  if (player) redirect('/game');
  return <main id="main" className="onboarding card"><span className="eyebrow">YOUR FIRST BIG DECISION</span><h1>Meet the founder.<br />That’s you.</h1><p>Pick a name and an original portrait. We’ll take care of your headquarters and founding grant.</p><OnboardingForm /><form action={signOut}><button className="text-button">Sign out</button></form></main>;
}
