import { useEffect, useCallback } from 'react';
import { useAuth } from '@/state/auth';
import { supabase } from '@/integrations/supabase/client';

export function useAuthSession() {
  const { user, refreshUser, isAuthReady } = useAuth();

  const verifySession = useCallback(async () => {
    if (!isAuthReady) {
      return true;
    }
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Erro ao verificar sessão:', error);
        return false;
      }

      if (!session && user) {
        console.warn('Sessão perdida, tentando refresh...');
        await refreshUser();
        return false;
      }

      if (session && !user) {
        console.warn('Usuário perdido, fazendo refresh...');
        await refreshUser();
        return false;
      }

      return !!session;
    } catch (error) {
      console.error('Erro inesperado ao verificar sessão:', error);
      return false;
    }
  }, [user, refreshUser, isAuthReady]);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Erro ao fazer refresh da sessão:', error);
        return false;
      }

      if (session) {
        console.log('Sessão refreshed com sucesso');
        await refreshUser();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro inesperado ao fazer refresh da sessão:', error);
      return false;
    }
  }, [refreshUser]);

  // Monitora mudanças na sessão a cada navegação
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    const checkSession = async () => {
      const isValid = await verifySession();
      if (!isValid && user) {
        console.warn('Tentando recuperar sessão...');
        await refreshSession();
      }
    };

    checkSession();
  }, [verifySession, refreshSession, user, isAuthReady]);

  return {
    verifySession,
    refreshSession
  };
}