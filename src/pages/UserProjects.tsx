import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/state/auth';
import { UserPhasesView } from '@/components/projects/UserPhasesView';

export default function UserProjects() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Show user phases for regular users, redirect others to main projects page
  if (user?.role === 'user') {
    return <UserPhasesView />;
  }

  // For supervisors and admins, this should show project management view
  return (
    <div className="space-y-6">
      <div className="text-lg">Carregando meus projetos...</div>
    </div>
  );
}
