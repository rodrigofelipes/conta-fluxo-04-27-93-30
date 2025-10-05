import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/state/auth';

export interface InternalContact {
  id: string;
  name: string;
  role: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  isOnline?: boolean;
}

export function useInternalChatContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<InternalContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async (options: { silent?: boolean } = {}) => {
    const { silent } = options;
    
    if (!user) {
      setContacts([]);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    try {
      // Buscar todos os perfis de usuários ativos, exceto o próprio usuário
      const { data: allProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email, role')
        .eq('active', true)
        .neq('user_id', user.id);

      if (profileError) {
        console.error('Erro ao buscar profiles:', profileError);
        setContacts([]);
        setLoading(false);
        return;
      }

      if (!allProfiles || allProfiles.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // Buscar última mensagem com cada usuário
      const contactsWithMessages = await Promise.all(
        allProfiles.map(async (profile) => {
          // Buscar última mensagem (enviada ou recebida)
          const { data: lastMessages, error: msgError } = await supabase
            .from('messages')
            .select('*')
            .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${profile.user_id}),and(from_user_id.eq.${profile.user_id},to_user_id.eq.${user.id})`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (msgError) {
            console.error('Erro ao buscar mensagens:', msgError);
          }

          const lastMessage = lastMessages && lastMessages.length > 0 ? lastMessages[0] : null;

          // Contar mensagens não lidas (recebidas deste contato)
          const { data: unreadMessages, error: unreadError } = await supabase
            .from('messages')
            .select('id')
            .eq('from_user_id', profile.user_id)
            .eq('to_user_id', user.id)
            .is('viewed_at', null);

          if (unreadError) {
            console.error('Erro ao buscar não lidas:', unreadError);
          }

          const unreadCount = unreadMessages?.length || 0;

          return {
            id: profile.user_id,
            name: profile.name || profile.email || 'Usuário',
            role: profile.role || 'user',
            unreadCount,
            lastMessage: lastMessage?.message || '',
            lastMessageTime: lastMessage?.created_at || '',
            isOnline: Math.random() > 0.5, // TODO: Implementar status real
          } as InternalContact;
        })
      );

      // Ordenar por última mensagem
      contactsWithMessages.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });

      setContacts(contactsWithMessages);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      setContacts([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    loading,
    refetch: fetchContacts,
  };
}
