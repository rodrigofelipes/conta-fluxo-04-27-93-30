import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleDriveAuth } from '@/hooks/useGoogleDriveAuth';

export default function GoogleDriveCallback() {
  const navigate = useNavigate();
  const { handleCallback } = useGoogleDriveAuth();

  useEffect(() => {
    const processCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');

      if (error) {
        console.error('OAuth error:', error);
        navigate('/settings');
        return;
      }

      if (code) {
        await handleCallback(code);
        navigate('/settings');
      }
    };

    processCallback();
  }, [handleCallback, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Processando autorização...</h2>
        <p className="text-muted-foreground">Aguarde enquanto concluímos a autorização do Google Drive</p>
      </div>
    </div>
  );
}
