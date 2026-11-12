import { Suspense } from 'react';
import Player from './Player';
import { realtimeConfig } from '@/lib/supabase/server';

export const metadata = { title: 'Intră în joc' };
export const dynamic = 'force-dynamic';

export default function JoinPage() {
  return (
    <Suspense>
      <Player rt={realtimeConfig()} />
    </Suspense>
  );
}
