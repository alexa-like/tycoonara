import { requireUser } from '@/lib/auth';
import { PasswordForm } from '@/components/forms';
import { AuthShell } from '@/components/auth-shell';
export const dynamic = 'force-dynamic';
export default async function UpdatePassword() {
  await requireUser();
  return <AuthShell recovery><PasswordForm /></AuthShell>;
}
