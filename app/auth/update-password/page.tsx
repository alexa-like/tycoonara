import { requireUser } from '@/lib/auth';
import { PasswordForm } from '@/components/forms';
export const dynamic = 'force-dynamic';
export default async function UpdatePassword() {
  await requireUser();
  return <main id="main" className="onboarding card"><h1>A new password.</h1><p>Choose at least 12 characters to keep your founder account safe.</p><PasswordForm /></main>;
}
