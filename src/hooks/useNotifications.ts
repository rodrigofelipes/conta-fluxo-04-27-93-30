import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export function useNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Função para verificar o status real das notificações
  const checkNotificationPermission = () => {
    if (!('Notification' in window)) {
      return false;
    }
    return Notification.permission === 'granted';
  };

  // Função para forçar atualização do status
  const refreshPermissionStatus = () => {
    const isGranted = checkNotificationPermission();
    setNotificationsEnabled(isGranted);
    console.log('Permission refreshed - Status:', Notification.permission, 'Enabled:', isGranted);
    return isGranted;
  };

  // Sincronizar estado das notificações
  useEffect(() => {
    refreshPermissionStatus();
    
    // Verificar periodicamente se o status mudou
    const interval = setInterval(() => {
      const currentStatus = checkNotificationPermission();
      if (currentStatus !== notificationsEnabled) {
        setNotificationsEnabled(currentStatus);
        console.log('Permission status changed:', currentStatus);
      }
    }, 1000);

    // Listener para mudanças de permissão (se suportado pelo navegador)
    let cleanup: (() => void) | undefined;
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then(permission => {
        const handleChange = () => {
          refreshPermissionStatus();
        };
        permission.addEventListener('change', handleChange);
        cleanup = () => permission.removeEventListener('change', handleChange);
      }).catch(() => {
        // Ignorar erro se não suportado pelo navegador
      });
    }

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, []);

  // Função para mostrar notificação
  const showNotification = (title: string, message: string, options?: NotificationOptions) => {
    // Só mostrar notificação do navegador se tiver permissão E estiver habilitado
    if (notificationsEnabled && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'app-notification',
        ...options
      });
    }

    // Sempre mostrar toast na interface (independente das notificações do navegador)
    toast({
      title,
      description: message,
      duration: 5000,
    });
  };

  // Função para alternar notificações
  const toggleNotifications = () => {
    // Forçar verificação antes de alternar
    const actualStatus = refreshPermissionStatus();
    const currentPermission = Notification.permission;
    
    console.log('Toggle notifications - Current permission:', currentPermission, 'Enabled:', actualStatus);
    
    if (actualStatus && currentPermission === 'granted') {
      // Desativar notificações (apenas visualmente, não podemos revogar permissão)
      setNotificationsEnabled(false);
      toast({
        title: "Notificações desativadas",
        description: "Você não receberá mais notificações de novas mensagens.",
        duration: 3000,
      });
    } else if (currentPermission === 'denied') {
      // Notificações bloqueadas - mostrar apenas instruções, não erro
      toast({
        title: "Como ativar notificações",
        description: "Para receber notificações: 1. Clique no ícone 🔒 na barra de endereços 2. Altere 'Notificações' para 'Permitir' 3. Recarregue a página",
        duration: 8000,
      });
    } else if (currentPermission === 'default') {
      // Solicitar permissão
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted');
        if (permission === 'granted') {
          toast({
            title: "Notificações ativadas ✅",
            description: "Você receberá notificações de novas mensagens.",
            duration: 3000,
          });
        } else if (permission === 'denied') {
          toast({
            title: "Como ativar notificações",
            description: "Para receber notificações: 1. Clique no ícone 🔒 na barra de endereços 2. Altere 'Notificações' para 'Permitir' 3. Recarregue a página",
            duration: 8000,
          });
        }
      });
    } else if (currentPermission === 'granted' && !actualStatus) {
      // Reativar notificações já permitidas
      setNotificationsEnabled(true);
      toast({
        title: "Notificações ativadas ✅",
        description: "Você receberá notificações de novas mensagens.",
        duration: 3000,
      });
    }
  };

  return {
    notificationsEnabled,
    showNotification,
    toggleNotifications,
    refreshPermissionStatus,
    canUseNotifications: 'Notification' in window,
    permissionStatus: 'Notification' in window ? Notification.permission : 'unsupported'
  };
}