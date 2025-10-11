import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function toCents(value: number) {
  return Math.round(value * 100);
}

function sanitizeDescription(description: string) {
  return description.trim().slice(0, 200) || 'Pagamento online';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const clientId: string | null = body.clientId ?? null;
    const financialTransactionId: string | null = body.financialTransactionId ?? null;
    const installmentId: string | null = body.installmentId ?? null;
    const amount: number = Number(body.amount ?? 0);
    const description: string = String(body.description ?? '').trim();
    const expiresInMinutes: number = Number(body.expiresInMinutes ?? 60 * 24 * 7);

    if (!clientId) {
      throw new Error('clientId is required');
    }
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      throw new Error('amount must be greater than zero');
    }
    if (!description) {
      throw new Error('description is required');
    }

    const { data: clientRecord } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();

    if (!clientRecord) {
      throw new Error('Client not found');
    }

    if (financialTransactionId) {
      const { data: transaction } = await supabase
        .from('client_financials')
        .select('id, client_id')
        .eq('id', financialTransactionId)
        .maybeSingle();
      if (!transaction) {
        throw new Error('Financial transaction not found');
      }
      if (transaction.client_id !== clientId) {
        throw new Error('Financial transaction does not belong to the provided client');
      }
    }

    if (installmentId) {
      const { data: installment } = await supabase
        .from('payment_installments')
        .select('id, client_id')
        .eq('id', installmentId)
        .maybeSingle();
      if (!installment) {
        throw new Error('Payment installment not found');
      }
      if (installment.client_id !== clientId) {
        throw new Error('Payment installment does not belong to the provided client');
      }
    }

    const linkToken = crypto.randomUUID().replace(/-/g, '');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
    const publicUrl = Deno.env.get('PUBLIC_URL') ?? 'http://localhost:5173';

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const shouldMockStripe = !stripeSecret || Deno.env.get('STRIPE_TEST_MODE') === 'mock';

    let checkoutSessionId: string | null = null;
    let checkoutUrl: string | null = null;

    if (!shouldMockStripe) {
      const params = new URLSearchParams();
      params.append('mode', 'payment');
      params.append('success_url', `${publicUrl}/pay/${linkToken}?status=success`);
      params.append('cancel_url', `${publicUrl}/pay/${linkToken}?status=cancelled`);
      params.append('metadata[link_token]', linkToken);
      params.append('metadata[client_id]', clientId);
      if (financialTransactionId) {
        params.append('metadata[financial_transaction_id]', financialTransactionId);
      }
      if (installmentId) {
        params.append('metadata[installment_id]', installmentId);
      }
      params.append('line_items[0][quantity]', '1');
      params.append('line_items[0][price_data][currency]', 'brl');
      params.append('line_items[0][price_data][unit_amount]', toCents(amount).toString());
      params.append('line_items[0][price_data][product_data][name]', sanitizeDescription(description));

      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Stripe checkout error', errorBody);
        throw new Error('Stripe checkout session could not be created');
      }

      const session = await response.json();
      checkoutSessionId = session.id ?? null;
      checkoutUrl = session.url ?? null;
    } else {
      checkoutSessionId = `mock_${crypto.randomUUID()}`;
      checkoutUrl = `${publicUrl}/pay/${linkToken}`;
    }

    const { data: linkRecord, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        client_id: clientId,
        financial_transaction_id: financialTransactionId,
        installment_id: installmentId,
        link_token: linkToken,
        stripe_checkout_session_id: checkoutSessionId,
        checkout_url: checkoutUrl,
        amount,
        description,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
        metadata: {
          source: 'create-payment-link',
          requested_by: user.email ?? user.id,
          mock_checkout: shouldMockStripe,
        },
      })
      .select()
      .single();

    if (insertError || !linkRecord) {
      throw insertError ?? new Error('Payment link could not be stored');
    }

    return new Response(
      JSON.stringify({
        success: true,
        linkToken,
        payment_link_url: `${publicUrl}/pay/${linkToken}`,
        checkoutUrl,
        sessionId: checkoutSessionId,
        link: linkRecord,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('create-payment-link error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
