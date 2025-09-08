import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/state/auth';

export interface Contact {
  id: string;
  nome: string;
  cnpj?: string;
  cidade?: string;
}

export function useContacts() {
  const { user } = useAuth();
  const isClient = user?.role === "user";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = async () => {
    console.log('fetchContacts called with user:', user);
    if (!user) {
      setContacts([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log('User is client:', isClient, 'User role:', user.role);
    
    try {
      // Buscar todos os perfis de usuários, exceto o próprio usuário
      const { data: allProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email, role')
        .neq('user_id', user.id);
        
      if (profileError) {
        console.error('Erro ao buscar profiles:', profileError);
        setContacts([]);
        setLoading(false);
        return;
      }
      
      if (allProfiles && allProfiles.length > 0) {
        const contacts = allProfiles.map(profile => ({
          id: profile.user_id,
          nome: profile.name || profile.email || 'Colaborador',
          cnpj: ''
        }));
        
        setContacts(contacts);
      } else {
        setContacts([]);
      }
      
    } catch (error) {
      console.error('Erro inesperado:', error);
      setContacts([]);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
  }, [user, isClient]);

  return {
    contacts,
    loading,
    isClient,
    refetch: fetchContacts
  };
}