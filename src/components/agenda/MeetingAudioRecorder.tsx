import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Utterance {
  start_ms: number;
  end_ms: number;
  transcript: string;
}

interface MeetingAudioRecorderProps {
  agendaId: string;
  onRecordingComplete: (ataId: string) => void;
}

export function MeetingAudioRecorder({ agendaId, onRecordingComplete }: MeetingAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    
    try {
      // Obter microfone com configurações de qualidade
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Configurar MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 48000
      });

      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      // Conectar ao WebSocket
      const ws = new WebSocket(
        `wss://wcdyxxthaqzchjpharwh.supabase.co/functions/v1/realtime-meeting`
      );

      ws.onopen = () => {
        console.log('✅ WebSocket conectado');
        ws.send(JSON.stringify({
          type: 'session.update',
          agenda_id: agendaId,
          session: {
            modalities: ['text'],
            instructions: 'Transcreva esta reunião com precisão. Identifique pausas naturais entre falas.',
            input_audio_format: 'pcm16',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              silence_duration_ms: 800
            }
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'conversation.item.input_audio_transcription.completed') {
            const elapsedMs = Date.now() - startTimeRef.current;
            
            setUtterances(prev => [...prev, {
              start_ms: data.start_time || elapsedMs - 3000,
              end_ms: elapsedMs,
              transcript: data.transcript
            }]);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WS:', error);
        }
      };

      ws.onerror = () => {
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar ao serviço de transcrição",
          variant: "destructive"
        });
      };

      wsRef.current = ws;

      // Capturar chunks de áudio
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Enviar para WebSocket se estiver aberto
          if (ws.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: base64
              }));
            };
            reader.readAsDataURL(event.data);
          }
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        ws?.close();
        
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Processar ata
        await processRecording();
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      
      setIsRecording(true);
      setIsConnecting(false);
      
      // Timer de duração
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast({
        title: "Gravação iniciada",
        description: "A reunião está sendo gravada e transcrita",
      });

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      setIsConnecting(false);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a gravação",
        variant: "destructive"
      });
    }
  }, [agendaId]);

  const processRecording = async () => {
    setIsProcessing(true);
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      // Converter blob para base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Usuário não autenticado');
        
        // Chamar edge function para processar
        const { data, error } = await supabase.functions.invoke('process-minutes', {
          body: {
            agenda_id: agendaId,
            audio_blob: base64Audio,
            utterances: utterances,
            duration_seconds: durationSec,
            user_id: userData.user.id
          }
        });
        
        if (error) throw error;
        
        toast({
          title: "Ata processada com sucesso",
          description: `${data.num_speakers} falantes identificados`,
        });
        
        onRecordingComplete(data.ata_id);
      };
      
    } catch (error) {
      console.error('Erro ao processar gravação:', error);
      toast({
        title: "Erro ao processar ata",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setDuration(0);
      setUtterances([]);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gravação de Ata Inteligente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isConnecting || isProcessing}
            variant={isRecording ? "destructive" : "default"}
            size="lg"
          >
            {isConnecting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
            ) : isProcessing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
            ) : isRecording ? (
              <><Square className="mr-2 h-4 w-4" /> Parar Gravação</>
            ) : (
              <><Mic className="mr-2 h-4 w-4" /> Iniciar Gravação</>
            )}
          </Button>
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {utterances.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <h4 className="text-sm font-medium">Transcrição em Tempo Real</h4>
            {utterances.map((utt, idx) => (
              <div key={idx} className="p-2 border-l-2 border-primary bg-muted/50 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {Math.floor(utt.start_ms / 60000)}:{String(Math.floor((utt.start_ms % 60000) / 1000)).padStart(2, '0')}
                  </Badge>
                </div>
                <p className="text-sm">{utt.transcript}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
