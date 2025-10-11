import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

function isExpired(dateIso: string) {
  return new Date(dateIso).getTime() < Date.now();
}

function normalizeMetadata(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {} as Record<string, unknown>;
}

async function fetchStripeSession(sessionId: string) {
  if (!stripeSecret) return null;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
    },
  });
  if (!response.ok) {
    console.warn('Failed to fetch stripe session details', await response.text());
    return null;
  }
  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const token: string | null = body.token ?? null;
    const includeStripe: boolean = Boolean(body.includeStripe);

    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: link, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('link_token', token)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      return new Response(JSON.stringify({ error: 'Payment link not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let updatedStatus = link.status;
    const nowIso = new Date().toISOString();

    if (link.status === 'active' && isExpired(link.expires_at)) {
      const baseMetadata = normalizeMetadata(link.metadata);
      await supabase
        .from('payment_links')
        .update({ status: 'expired', metadata: { ...baseMetadata, last_event: 'expired_by_system' } })
        .eq('id', link.id);
      updatedStatus = 'expired';
    }

    let stripeData: any = null;
    if (includeStripe && link.stripe_checkout_session_id) {
      stripeData = await fetchStripeSession(link.stripe_checkout_session_id);
      if (stripeData) {
        const baseMetadata = normalizeMetadata(link.metadata);
        if (stripeData.status === 'expired' && updatedStatus !== 'completed') {
          await supabase
            .from('payment_links')
            .update({
              status: 'expired',
              metadata: { ...baseMetadata, stripe_status: stripeData.status },
            })
            .eq('id', link.id);
          updatedStatus = 'expired';
        }
        if (stripeData.payment_status === 'paid' && updatedStatus !== 'completed') {
          await supabase
            .from('payment_links')
            .update({
              status: 'completed',
              paid_at: nowIso,
              metadata: { ...baseMetadata, stripe_status: stripeData.payment_status },
            })
            .eq('id', link.id);
          updatedStatus = 'completed';
        }
      }
    }

    await supabase
      .from('payment_links')
      .update({ accessed_at: nowIso })
      .eq('id', link.id);

    const { data: transactions } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('payment_link_id', link.id)
      .order('created_at', { ascending: false });

    return new Response(JSON.stringify({
      link: { ...link, status: updatedStatus, accessed_at: nowIso },
      transactions,
      stripe: stripeData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('verify-payment-status error', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
