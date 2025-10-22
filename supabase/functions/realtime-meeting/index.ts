import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openaiWs: WebSocket | null = null;
  let agendaId: string | null = null;

  socket.onopen = () => {
    console.log('🔌 Cliente conectado');
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Capturar agenda_id na primeira mensagem
      if (data.agenda_id) {
        agendaId = data.agenda_id;
        console.log(`📋 Ata para agenda: ${agendaId}`);
      }

      // Conectar à OpenAI na primeira mensagem
      if (!openaiWs && data.type === 'session.update') {
        openaiWs = new WebSocket(
          `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`
        );

        openaiWs.onopen = () => {
          console.log('✅ Conectado à OpenAI Realtime');
          
          // Enviar configuração inicial com header de autorização
          openaiWs?.send(JSON.stringify({
            type: 'session.update',
            session: {
              ...data.session,
              modalities: ['text'],
              input_audio_format: 'pcm16',
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                silence_duration_ms: 800
              }
            }
          }));
        };

        openaiWs.onmessage = (event) => {
          try {
            const wsData = JSON.parse(event.data);
            
            // Aplicar backpressure: verificar buffer
            if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 2_000_000) {
              socket.send(event.data);
            } else {
              console.warn('⚠️ Backpressure: descartando mensagem (buffer alto)');
            }
          } catch (e) {
            console.error('❌ Erro ao processar mensagem OpenAI:', e);
          }
        };

        openaiWs.onerror = (error) => {
          console.error('❌ Erro OpenAI WS:', error);
          socket.send(JSON.stringify({
            type: 'error',
            error: 'OpenAI connection failed'
          }));
        };

        openaiWs.onclose = () => {
          console.log('🔌 OpenAI desconectado');
        };
      }

      // Repassar eventos do cliente para OpenAI
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        if (data.type === 'input_audio_buffer.append') {
          // Backpressure: verificar buffer antes de enviar
          if (openaiWs.bufferedAmount < 2_000_000) {
            openaiWs.send(JSON.stringify(data));
          } else {
            console.warn('⚠️ Backpressure OpenAI: descartando chunk de áudio');
          }
        } else {
          openaiWs.send(JSON.stringify(data));
        }
      }

    } catch (error) {
      console.error('❌ Erro ao processar mensagem:', error);
      socket.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  socket.onclose = () => {
    openaiWs?.close();
    console.log('🔌 Cliente desconectado');
  };

  socket.onerror = (error) => {
    console.error('❌ Erro no socket cliente:', error);
    openaiWs?.close();
  };

  return response;
});
