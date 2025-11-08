import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface NotificationRequest {
  notification_id: string;
  send_whatsapp?: boolean;
  send_email?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const { notification_id, send_whatsapp = true, send_email = true }: NotificationRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Autenticar usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Não autorizado');
    }

    console.log(`📤 Enviando notificação ${notification_id} para usuário ${user.id}`);

    // Buscar detalhes da notificação
    const { data: notification, error: notifError } = await supabase
      .from('overdue_expense_notifications')
      .select(`
        *,
        client:clients(id, name, email, phone)
      `)
      .eq('id', notification_id)
      .single();

    if (notifError || !notification) {
      throw new Error('Notificação não encontrada');
    }

    // Buscar despesas relacionadas
    const { data: expenses } = await supabase
      .from('client_financials')
      .select('*')
      .in('id', notification.expense_ids);

    const client = notification.client;
    const results: any = { whatsapp: null, email: null };

    // Gerar mensagem formatada
    const message = `
Olá ${client.name.split(' ')[0]}!

Identificamos que há ${notification.expense_count} ${notification.expense_count > 1 ? 'despesas vencidas' : 'despesa vencida'} em aberto no valor total de R$ ${Number(notification.total_amount).toFixed(2).replace('.', ',')}.

📅 Vencimento: ${new Date(notification.due_date).toLocaleDateString('pt-BR')}

Detalhes:
${expenses?.map(exp => 
  `• ${exp.description} - R$ ${Number(exp.amount).toFixed(2).replace('.', ',')}`
).join('\n')}

Por favor, regularize a situação o quanto antes.

Em caso de dúvidas, entre em contato conosco.

Atenciosamente,
Equipe Financeira
`.trim();

    // Enviar WhatsApp
    if (send_whatsapp && client.phone) {
      console.log('📱 Enviando WhatsApp para:', client.phone);
      
      const whatsappResponse = await supabase.functions.invoke('whatsapp-send', {
        body: {
          to: client.phone,
          message
        }
      });

      results.whatsapp = whatsappResponse;

      if (!whatsappResponse.error) {
        const newStatus = notification.email_sent_at ? 'both_sent' : 'whatsapp_sent';
        
        await supabase
          .from('overdue_expense_notifications')
          .update({
            whatsapp_sent_at: new Date().toISOString(),
            whatsapp_sent_by: user.id,
            whatsapp_message_id: whatsappResponse.data?.data?.messages?.[0]?.id,
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', notification_id);

        console.log('✅ WhatsApp enviado com sucesso');
      }
    }

    // Enviar Email (placeholder - implementar quando integração estiver pronta)
    if (send_email && client.email) {
      console.log('📧 Email para:', client.email, '(funcionalidade em desenvolvimento)');
      
      results.email = { pending: true, message: 'Integração de email em desenvolvimento' };

      const newStatus = notification.whatsapp_sent_at ? 'both_sent' : 'email_sent';
      
      await supabase
        .from('overdue_expense_notifications')
        .update({
          email_sent_at: new Date().toISOString(),
          email_sent_by: user.id,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', notification_id);
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Notificação enviada com sucesso',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro ao enviar notificação:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
