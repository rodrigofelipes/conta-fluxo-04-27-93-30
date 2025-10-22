import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para calcular IoU (Intersection over Union)
function calculateIoU(start1: number, end1: number, start2: number, end2: number): number {
  const intersection = Math.max(0, Math.min(end1, end2) - Math.max(start1, start2));
  const union = (end1 - start1) + (end2 - start2) - intersection;
  return union > 0 ? intersection / union : 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      agenda_id,
      audio_blob,
      utterances,
      duration_seconds,
      user_id
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`📝 Processando ata da agenda ${agenda_id}`);

    // Buscar profile_id do user
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!profile) {
      throw new Error('Usuário não encontrado');
    }

    // 1. Upload do áudio para Storage
    const audioFileName = `${profile.id}/${Date.now()}.webm`;
    const audioBlob = Uint8Array.from(atob(audio_blob), c => c.charCodeAt(0));
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meeting-audio')
      .upload(audioFileName, audioBlob, {
        contentType: 'audio/webm',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('meeting-audio')
      .getPublicUrl(audioFileName);

    console.log(`✅ Áudio salvo: ${audioFileName}`);

    // 2. Criar registro da ata
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 90);

    const { data: ata, error: ataError } = await supabase
      .from('meeting_atas')
      .insert({
        agenda_id,
        meeting_date: new Date().toISOString(),
        duration_minutes: Math.floor(duration_seconds / 60),
        status: 'processing',
        consent_obtained: true,
        consented_at: new Date().toISOString(),
        retention_until: retentionDate.toISOString().split('T')[0],
        audio_file_url: publicUrl,
        audio_size_bytes: audioBlob.length,
        created_by: profile.id
      })
      .select()
      .single();

    if (ataError) throw ataError;

    console.log(`✅ Ata criada: ${ata.id}`);

    // 3. Fazer diarização do áudio
    console.log('🎙️ Enviando áudio para diarização...');
    
    const diarizeUrl = Deno.env.get('DIARIZATION_SERVICE_URL') || 'https://ata-diarization.fly.dev';
    
    const formData = new FormData();
    formData.append('file', new Blob([audioBlob], { type: 'audio/webm' }), 'audio.webm');
    
    const diarResponse = await fetch(`${diarizeUrl}/diarize`, {
      method: 'POST',
      body: formData
    });

    if (!diarResponse.ok) {
      throw new Error(`Diarização falhou: ${await diarResponse.text()}`);
    }

    const { segments } = await diarResponse.json();
    console.log(`✅ Diarização: ${segments.length} segmentos identificados`);

    // 4. Alinhar transcrição com segmentos de diarização (IoU)
    const alignedUtterances = utterances.map((utt: any) => {
      let bestMatch = null;
      let bestIoU = 0;
      const IOU_THRESHOLD = 0.3;

      // Converter ms para segundos para comparar com segmentos
      const uttStartSec = utt.start_ms / 1000;
      const uttEndSec = utt.end_ms / 1000;

      for (const segment of segments) {
        const iou = calculateIoU(uttStartSec, uttEndSec, segment.start, segment.end);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestMatch = segment;
        }
      }

      return {
        ...utt,
        diar_label: (bestMatch && bestIoU >= IOU_THRESHOLD) ? bestMatch.speaker : 'unknown',
        confidence_score: bestIoU
      };
    });

    // 5. Inserir utterances no banco
    const { error: uttError } = await supabase
      .from('utterances')
      .insert(
        alignedUtterances.map((u: any) => ({
          ata_id: ata.id,
          start_ms: u.start_ms,
          end_ms: u.end_ms,
          diar_label: u.diar_label,
          transcript: u.transcript,
          confidence_score: u.confidence_score
        }))
      );

    if (uttError) throw uttError;

    console.log(`✅ ${alignedUtterances.length} utterances salvas`);

    // 6. Gerar sumário com OpenAI
    const fullTranscript = alignedUtterances
      .map((u: any) => `[${u.diar_label}]: ${u.transcript}`)
      .join('\n\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em análise de atas de reunião.

Analise a transcrição e gere:
1. Resumo executivo (3-5 parágrafos)
2. Lista de decisões tomadas
3. Lista de tarefas com responsáveis e prazos estimados

Retorne APENAS JSON válido neste formato:
{
  "summary": "...",
  "decisions": ["decisão 1", "decisão 2"],
  "action_items": [
    {"task": "...", "responsible": "...", "deadline": "..."}
  ]
}`
          },
          {
            role: 'user',
            content: fullTranscript
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      }),
    });

    const aiResult = await openaiResponse.json();
    const analysis = JSON.parse(aiResult.choices[0].message.content);

    console.log('✅ Análise AI concluída');

    // 7. Atualizar ata com análise
    const { error: updateError } = await supabase
      .from('meeting_atas')
      .update({
        processed_summary: analysis.summary,
        decisions: analysis.decisions,
        action_items: analysis.action_items,
        status: 'completed'
      })
      .eq('id', ata.id);

    if (updateError) throw updateError;

    console.log('✅ Ata finalizada');

    return new Response(
      JSON.stringify({ 
        ata_id: ata.id, 
        success: true,
        speakers_detected: [...new Set(segments.map((s: any) => s.speaker))],
        num_speakers: new Set(segments.map((s: any) => s.speaker)).size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao processar ata:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
