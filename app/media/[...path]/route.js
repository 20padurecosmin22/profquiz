import { supabaseAdmin } from '@/lib/supabase/server';

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export async function GET(_request, { params }) {
  const { path } = await params;
  const parts = (path || []).map((p) => decodeURIComponent(p));
  const valid = parts.length === 3 && parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p)) && !parts.some((p) => p.startsWith('.'));
  const ext = valid ? parts[2].split('.').pop().toLowerCase() : '';
  if (!valid || !TYPES[ext]) return new Response('Not found', { status: 404 });

  const admin = supabaseAdmin();
  if (!admin) return new Response('Not found', { status: 404 });
  const { data, error } = await admin.storage.from('quiz-images').download(parts.join('/'));
  if (error || !data) return new Response('Not found', { status: 404 });

  return new Response(data.stream(), {
    headers: {
      'Content-Type': TYPES[ext],
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
}
