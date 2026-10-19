import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  // Public pages do not need an auth network roundtrip for visitors without cookies.
  if (!request.cookies.getAll().some(c => c.name.startsWith('sb-'))) return response;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set('Cache-Control', 'private, no-store');
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
export const config = { matcher: ['/game/:path*', '/onboarding/:path*', '/auth/:path*', '/login'] };
