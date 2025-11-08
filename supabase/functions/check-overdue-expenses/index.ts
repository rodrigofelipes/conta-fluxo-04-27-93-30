import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('🔍 Verificando despesas vencidas há 5 dias...');

    // Buscar despesas vencidas agrupadas por cliente
    const { data: overdueGroups, error: queryError } = await supabase
      .rpc('get_overdue_expenses_for_notification');

    if (queryError) {
      console.error('Erro ao buscar despesas:', queryError);
      throw queryError;
    }

    console.log(`📊 Encontrados ${overdueGroups?.length || 0} grupos de despesas vencidas`);

    if (!overdueGroups || overdueGroups.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        message: 'Nenhuma despesa vencida há 5 dias encontrada',
        count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Criar notificações pendentes para cada cliente
    const notifications = overdueGroups.map(group => ({
      client_id: group.client_id,
      expense_ids: group.expense_ids,
      due_date: group.due_date,
      notification_date: new Date().toISOString().split('T')[0],
      total_amount: group.total_amount,
      expense_count: group.expense_count,
      status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('overdue_expense_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Erro ao inserir notificações:', insertError);
      throw insertError;
    }

    console.log(`✅ ${notifications.length} notificações pendentes criadas`);

    return new Response(JSON.stringify({
      ok: true,
      message: 'Notificações criadas com sucesso',
      count: notifications.length,
      notifications
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar despesas vencidas:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
