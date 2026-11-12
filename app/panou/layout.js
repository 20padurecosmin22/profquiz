import { redirect } from 'next/navigation';
import Sidebar from './Sidebar';
import { currentTeacher } from '@/lib/supabase/server';

export default async function PanelLayout({ children }) {
  const { user, profile } = await currentTeacher();
  if (!user) redirect('/autentificare?next=/panou');
  return (
    <div className="app-shell">
      <Sidebar name={profile?.full_name} institution={profile?.institution} />
      <div className="app-main">{children}</div>
    </div>
  );
}
