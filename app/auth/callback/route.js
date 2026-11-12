import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  let next = searchParams.get('next') || '/panou';
  if (!next.startsWith('/') || next.startsWith('//')) next = '/panou';

  const supabase = await supabaseServer();
  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }
  return NextResponse.redirect(ok ? `${origin}${next}` : `${origin}/autentificare?eroare=link`);
}
