import { AuthForm } from '@/components/forms';
import { AuthShell } from '@/components/auth-shell';
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <AuthShell><AuthForm notice={notice}/></AuthShell>;
}
