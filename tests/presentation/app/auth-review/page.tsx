// Visual fixture only, served by a separate test app. Production routes still require auth.
import Login from '@/app/login/page';
import { AuthShell } from '@/components/auth-shell';
import { PasswordForm } from '@/components/forms';
export default async function AuthReview({searchParams}: {searchParams:Promise<{screen?:string;notice?:string}>}) {
  const params=await searchParams;
  return params.screen==='update'?<AuthShell recovery><PasswordForm/></AuthShell>:<Login searchParams={Promise.resolve(params)}/>;
}
