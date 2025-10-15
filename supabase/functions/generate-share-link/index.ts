import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment configuration');
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { documentId, expiresInMinutes = 60, scope = 'read' } = await req.json();

    if (!documentId) {
      throw new Error('documentId is required');
    }

    // Verify document exists and user has access
    const { data: document, error: docError } = await userClient
      .from('client_documents')
      .select('id, document_name')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or access denied');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate high-entropy token
    const tokenPart1 = crypto.randomUUID();
    const tokenPart2 = crypto.randomUUID();
    const timestamp = Date.now().toString(36);
    const shareToken = `${tokenPart1}-${timestamp}-${tokenPart2}`;

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Create share token
    const { data: tokenData, error: tokenError } = await supabase
      .from('document_share_tokens')
      .insert({
        document_id: documentId,
        token: shareToken,
        scope,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (tokenError) {
      throw tokenError;
    }

    // Log event
    await supabase.from('document_events_log').insert({
      document_id: documentId,
      user_id: user.id,
      event_type: 'share_created',
      metadata: {
        token: shareToken,
        scope,
        expires_at: expiresAt.toISOString(),
      },
    });

    const publicUrl = Deno.env.get('PUBLIC_URL') || 'http://localhost:8080';

    return new Response(
      JSON.stringify({
        success: true,
        token: shareToken,
        shareUrl: `${publicUrl}/shared/${shareToken}`,
        expiresAt: expiresAt.toISOString(),
        scope,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error generating share link:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
