import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateEventRequest {
  agendaId: string;
  googleEventId: string;
  title?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string | null;
  location?: string | null;
  attendees?: Array<{ email: string; displayName?: string }>;
}

function normalizeTime(time: string): string {
  if (!time) return '00:00:00';
  const parts = time.split(':');
  if (parts.length === 2) return `${time}:00`;
  if (parts.length === 3) return time;
  return '00:00:00';
}

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT não configurado');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(signatureInput);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(serviceAccount.private_key.replace(/-----.*-----/g, '').replace(/\n/g, '')), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${signatureInput}.${encodedSignature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function updateCalendarEvent(
  eventId: string,
  payload: UpdateEventRequest,
  accessToken: string
): Promise<any> {
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID') || 'primary';
  const timeZone = Deno.env.get('GOOGLE_CALENDAR_TIMEZONE') || 'America/Sao_Paulo';

  const eventData: any = {};

  if (payload.title) eventData.summary = payload.title;
  if (payload.description !== undefined) eventData.description = payload.description || '';
  if (payload.location !== undefined) eventData.location = payload.location || '';

  if (payload.startDate && payload.startTime) {
    const startDateTime = `${payload.startDate}T${normalizeTime(payload.startTime)}`;
    const endDateTime = payload.endDate && payload.endTime
      ? `${payload.endDate}T${normalizeTime(payload.endTime)}`
      : `${payload.startDate}T${normalizeTime(payload.startTime)}`;

    eventData.start = {
      dateTime: startDateTime,
      timeZone,
    };
    eventData.end = {
      dateTime: endDateTime,
      timeZone,
    };
  }

  if (payload.attendees) {
    eventData.attendees = payload.attendees.map(a => ({
      email: a.email,
      displayName: a.displayName,
    }));
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao atualizar evento: ${error}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: UpdateEventRequest = await req.json();

    if (!payload.agendaId || !payload.googleEventId) {
      throw new Error('agendaId e googleEventId são obrigatórios');
    }

    const accessToken = await getAccessToken();
    const updatedEvent = await updateCalendarEvent(payload.googleEventId, payload, accessToken);

    await supabase.from('agenda').update({
      google_calendar_synced_at: new Date().toISOString(),
    }).eq('id', payload.agendaId);

    await supabase.from('google_calendar_sync_log').insert({
      agenda_id: payload.agendaId,
      google_event_id: payload.googleEventId,
      sync_direction: 'system_to_google',
      sync_status: 'success',
      operation: 'update',
      metadata: { event_data: updatedEvent },
    });

    return new Response(
      JSON.stringify({ success: true, event: updatedEvent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao atualizar evento no Google Calendar:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});