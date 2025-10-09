import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID'; // Será configurado pelo usuário
const SCOPES = 'https://www.googleapis.com/auth/drive';

export function useGoogleDriveAuth() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from('google_drive_tokens')
        .select('expires_at')
        .eq('user_id', session.user.id)
        .single();

      if (!error && data) {
        const expiresAt = new Date(data.expires_at);
        setIsAuthorized(expiresAt > new Date());
      }
    } catch (error) {
      console.error('Error checking authorization:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const authorize = async () => {
    try {
      const redirectUri = `${window.location.origin}/google-drive-callback`;
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error starting authorization:', error);
      toast({
        title: 'Erro na autorização',
        description: 'Não foi possível iniciar a autorização do Google Drive',
        variant: 'destructive',
      });
    }
  };

  const handleCallback = async (code: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const redirectUri = `${window.location.origin}/google-drive-callback`;
      
      const { error } = await supabase.functions.invoke('google-oauth-callback', {
        body: { code, redirectUri },
      });

      if (error) throw error;

      setIsAuthorized(true);
      toast({
        title: 'Autorização concedida',
        description: 'Google Drive autorizado com sucesso',
      });
    } catch (error) {
      console.error('Error handling callback:', error);
      toast({
        title: 'Erro na autorização',
        description: 'Não foi possível completar a autorização',
        variant: 'destructive',
      });
    }
  };

  const revoke = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('google_drive_tokens')
        .delete()
        .eq('user_id', session.user.id);

      setIsAuthorized(false);
      toast({
        title: 'Autorização revogada',
        description: 'Acesso ao Google Drive removido',
      });
    } catch (error) {
      console.error('Error revoking authorization:', error);
      toast({
        title: 'Erro ao revogar',
        description: 'Não foi possível remover a autorização',
        variant: 'destructive',
      });
    }
  };

  return {
    isAuthorized,
    isChecking,
    authorize,
    handleCallback,
    revoke,
  };
}
