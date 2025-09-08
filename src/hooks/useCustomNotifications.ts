import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface CustomNotification {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  clientName?: string;
  contactId?: string;
}

export function useCustomNotifications() {
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Carregar configurações do localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem('customNotifications');
    const savedSound = localStorage.getItem('notificationSound');
    
    if (savedEnabled !== null) {
      setIsEnabled(JSON.parse(savedEnabled));
    }
    if (savedSound !== null) {
      setSoundEnabled(JSON.parse(savedSound));
    }

    // Carregar notificações salvas
    const savedNotifications = localStorage.getItem('savedNotifications');
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        setNotifications(parsed);
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    }
  }, []);

  // Salvar notificações no localStorage
  useEffect(() => {
    localStorage.setItem('savedNotifications', JSON.stringify(notifications));
  }, [notifications]);

  // Função para tocar som de notificação
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    // Tentar primeiro o arquivo de áudio
    try {
      const audio = new Audio('/sounds/gentle-bell.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Fallback: gerar som sintético se arquivo não existir
        playSystemNotificationSound();
      });
    } catch (error) {
      // Fallback: gerar som sintético se arquivo não existir
      playSystemNotificationSound();
    }
  }, [soundEnabled]);

  // Função para gerar som sintético como fallback
  const playSystemNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Criar uma sequência de tons para simular um sino suave
      const playTone = (frequency: number, duration: number, delay: number = 0) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          
          // Envelope suave
          gainNode.gain.setValueAtTime(0, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };

      // Tocar sequência de tons (Mi - Dó)
      playTone(659.25, 0.3, 0);    // E5
      playTone(523.25, 0.4, 150);  // C5
      
    } catch (error) {
      console.log('Não foi possível gerar som sintético:', error);
    }
  }, []);

  // Função para mostrar notificação
  const showNotification = useCallback((
    title: string, 
    message: string, 
    type: CustomNotification['type'] = 'info',
    options?: {
      clientName?: string;
      contactId?: string;
      duration?: number;
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => {
    if (!isEnabled) return;

    const id = crypto.randomUUID();
    const newNotification: CustomNotification = {
      id,
      title,
      message,
      type,
      timestamp: new Date(),
      read: false,
      clientName: options?.clientName,
      contactId: options?.contactId,
    };

    // Adicionar à lista de notificações
    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // Máximo 50 notificações

    // Tocar som
    playNotificationSound();

    // Mostrar toast do Sonner
    const toastFunction = type === 'error' ? toast.error :
                         type === 'success' ? toast.success :
                         type === 'warning' ? toast.warning :
                         toast.message;

    toastFunction(title, {
      description: message,
      duration: options?.duration || 5000,
      action: options?.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
      style: {
        background: 'hsl(var(--background))',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))',
      }
    });

    return id;
  }, [isEnabled, playNotificationSound]);

  // Marcar notificação como lida
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  // Limpar notificações antigas
  const clearOldNotifications = useCallback(() => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    setNotifications(prev => 
      prev.filter(notification => notification.timestamp > oneDayAgo)
    );
  }, []);

  // Deletar notificação
  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Toggle das configurações
  const toggleNotifications = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    localStorage.setItem('customNotifications', JSON.stringify(newState));
    
    showNotification(
      newState ? "Notificações ativadas" : "Notificações desativadas",
      newState ? "Você receberá notificações de novas mensagens" : "Notificações desativadas",
      newState ? 'success' : 'info'
    );
  }, [isEnabled, showNotification]);

  const toggleSound = useCallback(() => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('notificationSound', JSON.stringify(newState));
  }, [soundEnabled]);

  // Contar notificações não lidas
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isEnabled,
    soundEnabled,
    showNotification,
    markAsRead,
    markAllAsRead,
    clearOldNotifications,
    deleteNotification,
    toggleNotifications,
    toggleSound,
  };
}