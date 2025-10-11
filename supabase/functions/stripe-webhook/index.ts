import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSignature(payload: string, secret: string, timestamp: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = encoder.encode(`${timestamp}.${payload}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return hex(signature);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function parseStripeSignature(header: string | null) {
  if (!header) return null;
  const parts = header.split(',');
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signaturePart = parts.find((part) => part.startsWith('v1='));
  if (!timestampPart || !signaturePart) return null;
  return {
    timestamp: timestampPart.replace('t=', ''),
    signature: signaturePart.replace('v1=', ''),
  };
}

function mergeMetadata(original: unknown, extra: Record<string, unknown>) {
  if (original && typeof original === 'object' && !Array.isArray(original)) {
    return { ...(original as Record<string, unknown>), ...extra };
  }
  return { ...extra };
}

async function handleCheckoutCompleted(supabase: ReturnType<typeof createClient>, event: any) {
  const session = event.data?.object ?? {};
  const sessionId = session.id as string | undefined;
  if (!sessionId) return;

  const { data: link } = await supabase
    .from('payment_links')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  if (!link) {
    console.warn('Payment link not found for session', sessionId);
    return;
  }

  const paymentIntent = (session.payment_intent ?? session.id) as string | null;
  const amountTotal = typeof session.amount_total === 'number' ? session.amount_total / 100 : link.amount;
  const methodTypes = Array.isArray(session.payment_method_types)
    ? session.payment_method_types.join(', ')
    : session.payment_method_types ?? null;

  const metadata = mergeMetadata(link.metadata, {
    last_event: event.type,
    stripe_session_status: session.status,
  });

  await supabase
    .from('payment_links')
    .update({
      status: 'completed',
      payment_method: methodTypes,
      paid_at: new Date().toISOString(),
      metadata,
    })
    .eq('id', link.id);

  const { data: existingTransaction } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('payment_link_id', link.id)
    .maybeSingle();

  const transactionPayload = {
    payment_link_id: link.id,
    client_id: link.client_id,
    client_financial_id: link.financial_transaction_id,
    installment_id: link.installment_id,
    stripe_payment_id: paymentIntent,
    stripe_session_id: sessionId,
    amount: amountTotal,
    status: 'succeeded',
    payment_method: methodTypes,
    payment_date: new Date().toISOString(),
    metadata: mergeMetadata({}, {
      event_id: event.id,
      payment_intent: paymentIntent,
    }),
  };

  if (existingTransaction) {
    await supabase
      .from('payment_transactions')
      .update(transactionPayload)
      .eq('id', existingTransaction.id);
  } else {
    await supabase
      .from('payment_transactions')
      .insert(transactionPayload);
  }

  if (link.financial_transaction_id) {
    await supabase
      .from('client_financials')
      .update({
        status: 'paid',
        payment_date: new Date().toISOString(),
        payment_method: methodTypes ?? 'online',
      })
      .eq('id', link.financial_transaction_id);
  }

  if (link.installment_id) {
    await supabase
      .from('payment_installments')
      .update({
        status: 'paid',
        payment_date: new Date().toISOString(),
        payment_method: methodTypes ?? 'online',
      })
      .eq('id', link.installment_id);
  }
}

async function handleCheckoutExpired(supabase: ReturnType<typeof createClient>, event: any) {
  const session = event.data?.object ?? {};
  const sessionId = session.id as string | undefined;
  if (!sessionId) return;

  const { data: link } = await supabase
    .from('payment_links')
    .select('*')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();

  if (!link) return;

  await supabase
    .from('payment_links')
    .update({
      status: 'expired',
      metadata: mergeMetadata(link.metadata, { last_event: event.type }),
    })
    .eq('id', link.id);
}

async function handlePaymentFailed(supabase: ReturnType<typeof createClient>, event: any) {
  const paymentIntent = event.data?.object ?? {};
  const paymentIntentId = paymentIntent.id as string | undefined;
  if (!paymentIntentId) return;

  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('stripe_payment_id', paymentIntentId)
    .maybeSingle();

  if (!transaction) return;

  await supabase
    .from('payment_transactions')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message ?? 'Pagamento não aprovado',
    })
    .eq('id', transaction.id);

  if (transaction.payment_link_id) {
    const { data: link } = await supabase
      .from('payment_links')
      .select('metadata')
      .eq('id', transaction.payment_link_id)
      .maybeSingle();

    await supabase
      .from('payment_links')
      .update({
        status: 'cancelled',
        metadata: mergeMetadata(link?.metadata, {
          last_event: event.type,
          error: paymentIntent.last_payment_error?.message,
        }),
      })
      .eq('id', transaction.payment_link_id);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok');
  }

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader = parseStripeSignature(req.headers.get('stripe-signature'));

  if (!signatureHeader) {
    console.error('Missing stripe-signature header');
    return new Response(JSON.stringify({ error: 'Invalid signature header' }), { status: 400 });
  }

  const expectedSignature = await computeSignature(rawBody, webhookSecret, signatureHeader.timestamp);

  if (!timingSafeEqual(signatureHeader.signature, expectedSignature)) {
    console.error('Stripe signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(supabase, event);
        break;
      case 'payment_intent.payment_failed':
      case 'checkout.session.async_payment_failed':
        await handlePaymentFailed(supabase, event);
        break;
      default:
        console.log(`Unhandled stripe event type ${event.type}`);
    }
  } catch (error) {
    console.error('Error handling stripe webhook event', error);
    return new Response(JSON.stringify({ received: false }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
