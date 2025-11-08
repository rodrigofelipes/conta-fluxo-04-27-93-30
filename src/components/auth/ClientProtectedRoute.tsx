import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientProtectedRoute() {
  const [isClient, setIsClient] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkClientAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsClient(false);
          setLoading(false);
          return;
        }

        // Verificar se o usuário tem um cliente vinculado
        const { data: clientData, error } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (error || !clientData) {
          setIsClient(false);
        } else {
          setIsClient(true);
        }
      } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        setIsClient(false);
      } finally {
        setLoading(false);
      }
    };

    checkClientAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkClientAccess();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!isClient) {
    return <Navigate to="/portal-cliente/login" replace />;
  }

  return <Outlet />;
}
