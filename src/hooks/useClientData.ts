import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  residential_address: string | null;
  construction_address: string | null;
  indication: string | null;
  classification: string;
}

export const useClientData = (userId: string | undefined) => {
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClientData = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('Erro ao buscar dados do cliente:', error);
          toast({
            variant: "destructive",
            title: "Erro ao carregar dados",
            description: "Não foi possível carregar suas informações.",
          });
          return;
        }

        setClientData(data);
      } catch (error) {
        console.error('Erro inesperado:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [userId, toast]);

  return { clientData, loading };
};
