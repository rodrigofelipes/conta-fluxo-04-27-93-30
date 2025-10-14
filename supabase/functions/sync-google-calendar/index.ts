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
  external_location: boolean | null;
  distance_km: number | null;
};

type CollaboratorProfile = {
  id: string;
  email: string | null;
  name: string | null;
  user_id: string | null;
  role?: string | null;
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

  // Adicionar informações de local externo
  if (agenda.external_location) {
    segments.push(`Local: Externo`);
    if (agenda.distance_km && agenda.distance_km > 0) {
      segments.push(`Distância: ${agenda.distance_km} km`);
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
    .select("id, email, name, user_id, role")
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
      "id, titulo, descricao, data, data_fim, horario, horario_fim, local, cliente, agenda_type, collaborators_ids, external_location, distance_km"
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
  const accessToken = await getAccessToken();
  
  // Apenas sincronizar eventos do sistema para o Google Calendar
  const systemResults = await syncSystemEventsToGoogle(accessToken);
  
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    errors: 0,
    system_created: systemResults.created,
    system_skipped: systemResults.skipped,
    system_errors: systemResults.errors,
  };
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
