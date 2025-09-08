import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, phone')
        .order('name');
        
      if (error) {
        console.error('Erro ao buscar clientes:', error);
        setClients([]);
        return;
      }
      
      setClients(data || []);
      
    } catch (error) {
      console.error('Erro inesperado:', error);
      setClients([]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return {
    clients,
    loading,
    refetch: fetchClients
  };
}