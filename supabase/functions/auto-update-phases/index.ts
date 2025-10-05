import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Iniciando atualização automática de fases por data...');

    // Executar função de atualização de status
    const { data: updateResult, error: updateError } = await supabase
      .rpc('auto_update_phase_status_by_date');

    if (updateError) {
      console.error('❌ Erro ao atualizar status das fases:', updateError);
      throw updateError;
    }

    const updatedCount = updateResult?.[0]?.updated_count || 0;
    const phaseIds = updateResult?.[0]?.phase_ids || [];

    console.log(`✅ ${updatedCount} fase(s) atualizada(s) para "em andamento"`);

    // Se houve atualizações, buscar informações das fases e notificar usuários
    if (updatedCount > 0 && phaseIds.length > 0) {
      const { data: updatedPhases, error: phasesError } = await supabase
        .from('project_phases')
        .select(`
          id,
          phase_name,
          start_date,
          assigned_to,
          supervised_by,
          project:projects(title, client:clients(name))
        `)
        .in('id', phaseIds);

      if (phasesError) {
        console.error('⚠️ Erro ao buscar detalhes das fases:', phasesError);
      } else {
        console.log('📋 Fases atualizadas:', updatedPhases);
        
        // Aqui você pode implementar notificações por email, WhatsApp, etc.
        // Por exemplo, notificar assigned_to e supervised_by
        for (const phase of updatedPhases || []) {
          console.log(`📢 Fase iniciada: ${phase.phase_name} (ID: ${phase.id})`);
          
          // TODO: Implementar sistema de notificações
          // - Enviar email para assigned_to
          // - Enviar email para supervised_by
          // - Criar notificação no sistema
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${updatedCount} fase(s) atualizada(s) com sucesso`,
        updated_count: updatedCount,
        phase_ids: phaseIds,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na função auto-update-phases:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
