import { useEffect } from "react";
import { useAuth } from "@/state/auth";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { SupervisorDashboard } from "@/components/dashboard/SupervisorDashboard";
import { UserDashboard } from "@/components/dashboard/UserDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Dashboard | Visão geral do sistema";
  }, []);

  if (!user) {
    return null;
  }

  const userName = user.name || user.username || 'Colaborador';

  // Renderizar dashboard específico baseado no role
  switch (user.role) {
    case 'admin':
      return <AdminDashboard userName={userName} />;
    
    case 'supervisor':
    case 'coordenador':
      return <SupervisorDashboard userName={userName} />;
    
    case 'user':
    default:
      return <UserDashboard userName={userName} />;
  }
}