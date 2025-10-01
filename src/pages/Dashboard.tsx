import { useEffect } from "react";
import { useAuth } from "@/state/auth";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { SupervisorDashboard } from "@/components/dashboard/SupervisorDashboard";
import { CoordinatorDashboard } from "@/components/dashboard/CoordinatorDashboard";
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
      return <SupervisorDashboard userName={userName} />;
    
    case 'coordenador':
      return <CoordinatorDashboard userName={userName} />;
    
    case 'marketing':
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Dashboard Marketing</h1>
          <p className="text-muted-foreground">Bem-vindo à área de marketing!</p>
        </div>
      );
    
    case 'user':
    default:
      return <UserDashboard userName={userName} />;
  }
}