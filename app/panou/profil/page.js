import { Suspense } from 'react';
import { currentTeacher } from '@/lib/supabase/server';
import ProfileForm from './ProfileForm';

export const metadata = { title: 'Profilul meu' };

export default async function ProfilePage() {
  const { user, profile } = await currentTeacher();
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Profilul meu</h1>
          <p>Numele și instituția apar pe testele pe care le publicați în bibliotecă.</p>
        </div>
      </div>
      <Suspense><ProfileForm email={user.email} profile={profile || { full_name: '', institution: '' }} /></Suspense>
    </div>
  );
}
