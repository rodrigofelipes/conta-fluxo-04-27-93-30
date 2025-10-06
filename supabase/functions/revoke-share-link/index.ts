import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { token: shareToken } = await req.json();

    if (!shareToken) {
      throw new Error('token is required');
    }

    // Verify token exists and user is the creator
    const { data: tokenData, error: tokenError } = await supabase
      .from('document_share_tokens')
      .select('id, document_id, created_by')
      .eq('token', shareToken)
      .maybeSingle();

    if (tokenError) {
      throw tokenError;
    }

    if (!tokenData) {
      throw new Error('Token not found');
    }

    if (tokenData.created_by !== user.id) {
      throw new Error('Not authorized to revoke this token');
    }

    // Revoke token
    const { error: revokeError } = await supabase
      .from('document_share_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', shareToken);

    if (revokeError) {
      throw revokeError;
    }

    // Log event
    await supabase.from('document_events_log').insert({
      document_id: tokenData.document_id,
      user_id: user.id,
      event_type: 'share_revoked',
      metadata: { token: shareToken },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token revoked successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error revoking share link:', error);
    
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
