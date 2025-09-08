import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  documentId: string;
  recipientEmail: string;
  recipientName?: string;
  subject?: string;
  message?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('send-document-email started');
    console.log('Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { documentId, recipientEmail, recipientName, subject, message }: EmailRequest = requestBody;

    console.log('Dados recebidos:', { documentId, recipientEmail, recipientName, subject, message });

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Supabase client criado');

    // Check RESEND_API_KEY first
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    console.log('RESEND_API_KEY configurado:', !!resendApiKey);
    
    if (!resendApiKey) {
      console.error('RESEND_API_KEY não configurada');
      throw new Error('RESEND_API_KEY não configurada');
    }

    // Get document details
    console.log('Buscando documento:', documentId);
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    console.log('Resultado da busca do documento:', { document: !!document, error: docError });

    if (docError || !document) {
      console.error('Erro ao buscar documento:', docError);
      throw new Error('Documento não encontrado: ' + (docError?.message || 'ID inválido'));
    }

    // Get document file URL
    console.log('Gerando URL para storage_path:', document.storage_path);
    const { data: urlData, error: urlError } = await supabaseClient.storage
      .from('task-files')
      .createSignedUrl(document.storage_path, 3600); // 1 hour expiry

    console.log('Resultado da geração de URL:', { urlData: !!urlData, urlError });

    if (urlError || !urlData) {
      console.error('Erro ao gerar URL:', urlError);
      throw new Error('Erro ao gerar URL do documento: ' + (urlError?.message || 'URL não gerada'));
    }

    // Prepare email content
    const emailSubject = subject || `Novo documento: ${document.name}`;
    const emailMessage = message || `
      Olá ${recipientName || ''},
      
      Você recebeu um novo documento: ${document.name}
      
      Categoria: ${document.category}
      Setor: ${document.uploader_setor}
      ${document.ref ? `Referência: ${document.ref}` : ''}
      
      Você pode baixar o documento através do link abaixo:
      ${urlData.signedUrl}
      
      Este link expira em 1 hora por segurança.
      
      Atenciosamente,
      Equipe de Documentos
    `;

    console.log('Preparando conteúdo do email');

    // Send email using Resend API directly

    console.log('Enviando email via Resend API para:', recipientEmail);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // Use este domínio padrão do Resend ou configure seu próprio
        to: [recipientEmail],
        subject: emailSubject,
        text: emailMessage,
        html: emailMessage.replace(/\n/g, '<br>'),
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Resend API error:', errorText);
      throw new Error(`Erro ao enviar email: ${errorText}`);
    }

    const emailData = await emailResponse.json();

    // Try to log email sent (optional, won't fail if table doesn't exist)
    try {
      await supabaseClient
        .from('email_logs')
        .insert({
          document_id: documentId,
          recipient_email: recipientEmail,
          subject: emailSubject,
          status: 'sent',
          email_id: emailData.id,
        });
    } catch (logError) {
      console.warn('Could not log email (table may not exist):', logError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email enviado com sucesso',
        emailId: emailData.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro no envio de email:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});