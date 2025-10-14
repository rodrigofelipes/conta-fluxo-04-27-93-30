import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";
import { DateTime } from "npm:luxon@3.5.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
const GOOGLE_SERVICE_ACCOUNT = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
const DEFAULT_TIME_ZONE = Deno.env.get("GOOGLE_CALENDAR_TIMEZONE") || "America/Sao_Paulo";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type AgendaRecord = {
  id: string;
  titulo: string | null;
  descricao: string | null;
  data: string;
  data_fim: string | null;
  horario: string | null;
  horario_fim: string | null;
  local: string | null;
  cliente: string | null;
  agenda_type: "pessoal" | "compartilhada" | null;
  collaborators_ids: string[] | null;
};

type CollaboratorProfile = {
  id: string;
  email: string | null;
  name: string | null;
};

function normalizeTime(time: string | null | undefined): string {
  if (!time) {
    return "00:00:00";
  }

  if (time.length === 5) {
    return `${time}:00`;
  }

  if (time.length === 8) {
    return time;
  }

  return time;
}

function buildAgendaDescription(
  agenda: AgendaRecord, 
  collaboratorMap: Map<string, CollaboratorProfile>
): string | undefined {
  const segments: string[] = [];

  if (agenda.cliente && agenda.cliente.trim().length > 0) {
    segments.push(`Cliente: ${agenda.cliente.trim()}`);
  }

  const sanitizedDescription = agenda.descricao?.trim();
  if (sanitizedDescription) {
    segments.push(sanitizedDescription);
  }

  // Adicionar participantes na descrição
  if (agenda.collaborators_ids && agenda.collaborators_ids.length > 0) {
    const participantes = agenda.collaborators_ids
      .map((collaboratorId) => collaboratorMap.get(collaboratorId))
      .filter((profile): profile is CollaboratorProfile => Boolean(profile?.name))
      .map((profile) => profile.name)
      .join(", ");
    
    if (participantes) {
      segments.push(`Participantes: ${participantes}`);
    }
  }

  if (agenda.agenda_type) {
    segments.push(`Tipo de agenda: ${agenda.agenda_type === "pessoal" ? "Pessoal" : "Compartilhada"}`);
  }

  if (segments.length === 0) {
    return undefined;
  }

  return segments.join("\n\n");
}

function getAgendaDateTimeRange(
  agenda: AgendaRecord,
  timeZone: string
): { start: string; end: string } {
  const start = DateTime.fromISO(`${agenda.data}T${normalizeTime(agenda.horario)}`, {
    zone: timeZone,
  });

  if (!start.isValid) {
    throw new Error(`Data ou horário inicial inválido para o agendamento ${agenda.id}`);
  }

  const endDate = agenda.data_fim || agenda.data;
  let end: DateTime;

  if (agenda.horario_fim) {
    end = DateTime.fromISO(`${endDate}T${normalizeTime(agenda.horario_fim)}`, {
      zone: timeZone,
    });
  } else {
    const base = DateTime.fromISO(`${endDate}T${normalizeTime(agenda.horario)}`, {
      zone: timeZone,
    });
    end = base.isValid ? base.plus({ hours: 1 }) : start.plus({ hours: 1 });
  }

  if (!end.isValid || end <= start) {
    end = start.plus({ hours: 1 });
  }

  return {
    start: start.toISO(),
    end: end.toISO(),
  };
}



async function fetchCollaboratorsMap(collaboratorIds: string[]): Promise<Map<string, CollaboratorProfile>> {
  if (!collaboratorIds.length) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, name")
    .in("id", collaboratorIds);

  if (error) {
    console.error("Erro ao buscar colaboradores para sincronização com Google Calendar:", error);
    return new Map();
  }

  const map = new Map<string, CollaboratorProfile>();
  for (const profile of data as CollaboratorProfile[]) {
    map.set(profile.id, profile);
  }

  return map;
}

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

/**
 * Parse ISO 8601 datetime string (with timezone) to { date, time }
 * Example: "2025-10-14T02:00:00-03:00" -> { date: "2025-10-14", time: "02:00:00" }
 */
function parseISOWithTimezone(isoString: string): { date: string; time: string | null } {
  if (!isoString) {
    return { date: new Date().toISOString().split('T')[0], time: null };
  }

  // Check if it's a date-only string (e.g., "2025-10-14")
  if (!isoString.includes('T')) {
    return { date: isoString, time: null };
  }

  // Split ISO string into date and time parts
  const [datePart, timePart] = isoString.split('T');
  
  // Extract time without timezone offset (HH:MM:SS)
  const timeWithoutOffset = timePart.split(/[+-Z]/)[0];
  
  return {
    date: datePart,
    time: timeWithoutOffset || null
  };
}

async function syncSystemEventsToGoogle(accessToken: string) {
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Google Calendar ID is not configured");
  }

  const results = {
    created: 0,
    skipped: 0,
    errors: 0,
  };

  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setFullYear(timeMax.getFullYear() + 1);

  const { data: agendaEvents, error: agendaError } = await supabaseAdmin
    .from("agenda")
    .select(
      "id, titulo, descricao, data, data_fim, horario, horario_fim, local, cliente, agenda_type, collaborators_ids"
    )
    .is("google_event_id", null)
    .gte("data", timeMin.toISOString().split("T")[0])
    .lte("data", timeMax.toISOString().split("T")[0]);

  if (agendaError) {
    console.error("Erro ao buscar agendamentos não sincronizados:", agendaError);
    results.errors++;
    return results;
  }

  if (!agendaEvents?.length) {
    return results;
  }

  const collaboratorIds = new Set<string>();
  for (const agenda of agendaEvents as AgendaRecord[]) {
    agenda.collaborators_ids?.forEach((id) => {
      if (id) {
        collaboratorIds.add(id);
      }
    });
  }

  const collaboratorMap = await fetchCollaboratorsMap(Array.from(collaboratorIds));

  for (const agenda of agendaEvents as AgendaRecord[]) {
    try {
      const { start, end } = getAgendaDateTimeRange(agenda, DEFAULT_TIME_ZONE);
      const description = buildAgendaDescription(agenda, collaboratorMap);

      const attendees = (agenda.collaborators_ids || [])
        .map((collaboratorId) => collaboratorMap.get(collaboratorId))
        .filter((profile): profile is CollaboratorProfile => Boolean(profile?.email))
        .map((profile) => ({
          email: profile.email as string,
          displayName: profile.name ?? undefined,
        }));

      const eventBody = {
        summary: agenda.titulo || "Sem título",
        description,
        location: agenda.local || undefined,
        start: {
          dateTime: start,
          timeZone: DEFAULT_TIME_ZONE,
        },
        end: {
          dateTime: end,
          timeZone: DEFAULT_TIME_ZONE,
        },
        // NÃO incluir attendees devido à limitação da Service Account
        // attendees: attendees.length ? attendees : undefined,
        extendedProperties: {
          private: {
            agendaId: agenda.id,
            agendaType: agenda.agenda_type || "compartilhada",
          },
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        }
      );

      if (!response.ok) {
        const errorPayload = await response.text();
        console.error(
          `Google Calendar API error ao criar evento para agenda ${agenda.id}:`,
          errorPayload
        );
        results.errors++;
        continue;
      }

      const createdEvent = (await response.json()) as { id: string };

      const { error: updateError } = await supabaseAdmin
        .from("agenda")
        .update({
          google_event_id: createdEvent.id,
          google_calendar_synced_at: new Date().toISOString(),
        })
        .eq("id", agenda.id);

      if (updateError) {
        console.error(
          `Erro ao atualizar agenda ${agenda.id} com google_event_id ${createdEvent.id}:`,
          updateError
        );
        results.errors++;
        continue;
      }

      const { error: logError } = await supabaseAdmin.from("google_calendar_sync_log").insert({
        google_event_id: createdEvent.id,
        agenda_id: agenda.id,
        operation: "create",
        sync_status: "success",
        sync_direction: "system_to_google",
        metadata: { event_summary: agenda.titulo },
      });

      if (logError) {
        console.error(
          `Erro ao registrar log de sincronização para agenda ${agenda.id} e evento ${createdEvent.id}:`,
          logError
        );
      }

      results.created++;
    } catch (error) {
      console.error(`Erro ao sincronizar agenda ${agenda.id} com Google Calendar:`, error);
      results.errors++;
    }
  }

  return results;
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
    system_created: 0,
    system_skipped: 0,
    system_errors: 0,
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

  const systemResults = await syncSystemEventsToGoogle(accessToken);
  syncResults.system_created = systemResults.created;
  syncResults.system_skipped = systemResults.skipped;
  syncResults.system_errors = systemResults.errors;

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
