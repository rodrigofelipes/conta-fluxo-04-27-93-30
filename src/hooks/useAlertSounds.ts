import { useState, useEffect, useCallback } from 'react';

interface AlertSound {
  name: string;
  url: string;
  description: string;
}

const ALERT_SOUNDS: AlertSound[] = [
  { name: 'gentle', url: '/sounds/gentle-bell.mp3', description: 'Sino Suave' },
  { name: 'urgent', url: '/sounds/urgent-beep.mp3', description: 'Beep Urgente' },
  { name: 'critical', url: '/sounds/critical-alarm.mp3', description: 'Alarme Crítico' },
  { name: 'notification', url: '/sounds/notification.mp3', description: 'Notificação' }
];

export function useAlertSounds() {
  const [volume, setVolume] = useState(0.7);
  const [enabled, setEnabled] = useState(true);
  const [currentSound, setCurrentSound] = useState<string | null>(null);

  // Carregar configurações salvas
  useEffect(() => {
    const savedVolume = localStorage.getItem('alertSoundVolume');
    const savedEnabled = localStorage.getItem('alertSoundEnabled');
    
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedEnabled) setEnabled(savedEnabled === 'true');
  }, []);

  // Salvar configurações
  const saveSettings = useCallback((newVolume?: number, newEnabled?: boolean) => {
    if (newVolume !== undefined) {
      setVolume(newVolume);
      localStorage.setItem('alertSoundVolume', newVolume.toString());
    }
    if (newEnabled !== undefined) {
      setEnabled(newEnabled);
      localStorage.setItem('alertSoundEnabled', newEnabled.toString());
    }
  }, []);

  // Reproduzir som
  const playSound = useCallback(async (soundName: string, repeat = 1) => {
    if (!enabled) return;

    try {
      setCurrentSound(soundName);
      
      // Criar um contexto de áudio para contornar políticas de autoplay
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Gerar som sintetizado como fallback
      const generateTone = (frequency: number, duration: number) => {
        const sampleRate = audioContext.sampleRate;
        const numSamples = sampleRate * duration;
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < numSamples; i++) {
          const time = i / sampleRate;
          channelData[i] = Math.sin(2 * Math.PI * frequency * time) * 0.3;
        }
        
        return buffer;
      };

      let buffer;
      
      // Tentar carregar arquivo de áudio primeiro
      const sound = ALERT_SOUNDS.find(s => s.name === soundName);
      if (sound) {
        try {
          const response = await fetch(sound.url);
          const arrayBuffer = await response.arrayBuffer();
          buffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
          console.warn('Arquivo de áudio não encontrado, usando som sintetizado');
        }
      }
      
      // Usar som sintetizado como fallback
      if (!buffer) {
        const frequencies = {
          gentle: 800,
          urgent: 1200,
          critical: 1600,
          notification: 600
        };
        
        buffer = generateTone(frequencies[soundName as keyof typeof frequencies] || 800, 0.3);
      }

      // Reproduzir som
      for (let i = 0; i < repeat; i++) {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        source.start(audioContext.currentTime + (i * 0.5));
        
        if (i === repeat - 1) {
          source.onended = () => setCurrentSound(null);
        }
      }
      
    } catch (error) {
      console.error('Erro ao reproduzir som de alerta:', error);
      setCurrentSound(null);
    }
  }, [enabled, volume]);

  // Event listener para sons de alerta
  useEffect(() => {
    const handleAlertSound = (event: CustomEvent) => {
      const { sound, level } = event.detail;
      const repeatCount = level === 'critical' ? 3 : 1;
      playSound(sound, repeatCount);
    };

    window.addEventListener('playAlertSound', handleAlertSound as EventListener);
    
    return () => {
      window.removeEventListener('playAlertSound', handleAlertSound as EventListener);
    };
  }, [playSound]);

  // Testar som
  const testSound = useCallback((soundName: string) => {
    playSound(soundName, 1);
  }, [playSound]);

  return {
    sounds: ALERT_SOUNDS,
    volume,
    enabled,
    currentSound,
    playSound,
    testSound,
    setVolume: (vol: number) => saveSettings(vol, undefined),
    setEnabled: (en: boolean) => saveSettings(undefined, en)
  };
}