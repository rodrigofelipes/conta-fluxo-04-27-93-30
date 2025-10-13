import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
const GOOGLE_SERVICE_ACCOUNT = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAccessToken(): Promise<string> {
  // Prefer full JSON secret if available, fallback to EMAIL/PRIVATE_KEY
  let clientEmail = GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  let privateKey = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  if (GOOGLE_SERVICE_ACCOUNT) {
    try {
      const svc = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
      clientEmail = svc.client_email || clientEmail;
      privateKey = svc.private_key || privateKey;
    } catch (e) {
      console.warn("GOOGLE_SERVICE_ACCOUNT is not valid JSON:", e);
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials are not configured");
  }

  const normalizeKey = (k: string) => {
    let key = (k || "").trim();
    if (key.startsWith('"') && key.endsWith('"')) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\r\n/g, "\n");
    return key;
  };

  const toBase64Url = (str: string) => btoa(str)
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const bytesToBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

  const key = normalizeKey(privateKey);
  // Extract PKCS8 payload between header/footer if present
  const match = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  const pkcs8Base64 = match ? match[1].replace(/\s+/g, '') : key.replace(/-----.*-----/g, '').replace(/\s+/g, '');

  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const input = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const toSign = encoder.encode(input);

  const pkcs8Der = Uint8Array.from(atob(pkcs8Base64), c => c.charCodeAt(0));
  const privateKeyObj = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKeyObj, toSign);
  const jwt = `${input}.${bytesToBase64Url(new Uint8Array(signature))}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Failed to obtain Google access token: ${errText}`);
  }

  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token as string | undefined;
  if (!accessToken) {
    throw new Error('Failed to obtain Google access token (no token in response)');
  }
  return accessToken;
}

async function syncEventsFromGoogle() {
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Google Calendar ID is not configured");
  }

  const accessToken = await getAccessToken();
  
  // Buscar eventos dos últimos 7 dias e próximos 30 dias
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 30);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?` +
    `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error fetching Google Calendar events:", errorText);
    throw new Error("Failed to fetch events from Google Calendar");
  }

  const data = await response.json();
  const events = data.items || [];

  console.log(`Found ${events.length} events in Google Calendar`);

  const syncResults = {
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    errors: 0,
  };

  // Mapear IDs dos eventos do Google Calendar
  const googleEventIds = events.map((e: any) => e.id);

  // Buscar eventos na agenda que têm google_event_id mas não existem mais no Google Calendar
  const { data: agendaEvents } = await supabaseAdmin
    .from("agenda")
    .select("id, google_event_id")
    .not("google_event_id", "is", null);

  if (agendaEvents) {
    for (const agendaEvent of agendaEvents) {
      if (agendaEvent.google_event_id && !googleEventIds.includes(agendaEvent.google_event_id)) {
        // Evento foi deletado no Google Calendar, deletar da agenda
        const { error } = await supabaseAdmin
          .from("agenda")
          .delete()
          .eq("id", agendaEvent.id);

        if (error) {
          console.error(`Erro ao deletar evento ${agendaEvent.id}:`, error);
          syncResults.errors++;
        } else {
          syncResults.deleted++;
          
          // Log da sincronização
          await supabaseAdmin.from("google_calendar_sync_log").insert({
            google_event_id: agendaEvent.google_event_id,
            agenda_id: agendaEvent.id,
            operation: "delete",
            sync_status: "success",
            sync_direction: "from_google",
            metadata: { reason: "Event deleted from Google Calendar" },
          });
        }
      }
    }
  }

  for (const event of events) {
    try {
      // Pular eventos sem data/hora definida
      if (!event.start?.dateTime && !event.start?.date) {
        syncResults.skipped++;
        continue;
      }

      // Verificar se já existe na agenda
      const { data: existing } = await supabaseAdmin
        .from("agenda")
        .select("id, updated_at")
        .eq("google_event_id", event.id)
        .maybeSingle();

      const startDateTime = event.start.dateTime || event.start.date;
      const endDateTime = event.end?.dateTime || event.end?.date || startDateTime;
      
      // Parser ISO com timezone: retorna [date, time] considerando o offset
      const parseISOWithTimezone = (isoString: string): { date: string; time: string | null } => {
        if (!isoString.includes('T')) {
          // Evento de dia inteiro (sem horário)
          return { date: isoString, time: null };
        }
        
        // Extrair a parte da data e hora
        const [datePart, timePart] = isoString.split('T');
        
        // Extrair HH:mm:ss (ignora timezone/offset, pois já está no fuso correto)
        const timeOnly = timePart.split(/[+-Z]/)[0]; // Remove timezone info
        
        return { date: datePart, time: timeOnly };
      };
      
      const startParsed = parseISOWithTimezone(startDateTime);
      const endParsed = parseISOWithTimezone(endDateTime);
      
      const agendaData = {
        titulo: event.summary || "Sem título",
        descricao: event.description || null,
        data: startParsed.date,
        data_fim: endParsed.date,
        horario: startParsed.time || "00:00:00",
        horario_fim: endParsed.time || null,
        local: event.location || null,
        cliente: "", // Pode ser extraído da descrição se necessário
        tipo: "reuniao_cliente",
        agenda_type: "compartilhada",
        visibility: "team",
        google_event_id: event.id,
        google_calendar_synced_at: new Date().toISOString(),
      };

      if (existing) {
        // Atualizar evento existente
        const eventUpdated = new Date(event.updated);
        const agendaUpdated = new Date(existing.updated_at);
        
        // Só atualizar se o evento do Google for mais recente
        if (eventUpdated > agendaUpdated) {
          const { error } = await supabaseAdmin
            .from("agenda")
            .update(agendaData)
            .eq("id", existing.id);

          if (error) {
            console.error(`Error updating agenda item ${existing.id}:`, error);
            syncResults.errors++;
          } else {
            syncResults.updated++;
            
            // Log da sincronização
            await supabaseAdmin.from("google_calendar_sync_log").insert({
              google_event_id: event.id,
              agenda_id: existing.id,
              operation: "update",
              sync_status: "success",
              sync_direction: "from_google",
              metadata: { event_summary: event.summary },
            });
          }
        } else {
          syncResults.skipped++;
        }
      } else {
        // Criar novo evento
        // Buscar todos os perfis admin para adicionar como colaboradores
        const { data: adminProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, user_id")
          .eq("role", "admin");

        if (!adminProfiles || adminProfiles.length === 0) {
          console.error("No admin users found to create agenda item");
          syncResults.errors++;
          continue;
        }

        // Usar o primeiro admin como created_by e adicionar todos como colaboradores
        const creatorUserId = adminProfiles[0].user_id;
        const allAdminProfileIds = adminProfiles.map(p => p.id);

        const { data: created, error } = await supabaseAdmin
          .from("agenda")
          .insert({
            ...agendaData,
            created_by: creatorUserId,
            collaborators_ids: allAdminProfileIds,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`Error creating agenda item:`, error);
          syncResults.errors++;
        } else {
          syncResults.created++;
          
          // Log da sincronização
          await supabaseAdmin.from("google_calendar_sync_log").insert({
            google_event_id: event.id,
            agenda_id: created.id,
            operation: "create",
            sync_status: "success",
            sync_direction: "from_google",
            metadata: { event_summary: event.summary },
          });
        }
      }
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      syncResults.errors++;
    }
  }

  return syncResults;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const results = await syncEventsFromGoogle();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronização concluída",
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error syncing from Google Calendar:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
