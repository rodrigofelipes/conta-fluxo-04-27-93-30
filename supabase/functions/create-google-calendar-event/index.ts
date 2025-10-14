import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";
import { DateTime } from "npm:luxon@3.5.0";
import { corsHeaders } from "../_shared/cors.ts";

type AgendaType = "pessoal" | "compartilhada";

type CalendarEventRequest = {
  agendaId: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  cliente?: string | null;
  agendaType: AgendaType;
  attendees?: Array<{ email: string; displayName?: string }>;
  timeZone?: string;
  externalLocation?: boolean;
  distanceKm?: number;
};

type CalendarEventResponse = {
  eventId: string;
  htmlLink?: string;
  status: "created" | "skipped";
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
const DEFAULT_TIME_ZONE = Deno.env.get("GOOGLE_CALENDAR_TIMEZONE") || "America/Sao_Paulo";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeTime(time: string): string {
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

function buildDescription(payload: CalendarEventRequest): string | undefined {
  const segments: string[] = [];

  if (payload.cliente) {
    segments.push(`Cliente: ${payload.cliente}`);
  }

  const sanitizedDescription = payload.description?.trim();
  if (sanitizedDescription) {
    segments.push(sanitizedDescription);
  }

  // Adicionar participantes na descrição
  if (payload.attendees && payload.attendees.length > 0) {
    const participantes = payload.attendees
      .map((attendee) => attendee.displayName || attendee.email)
      .join(", ");
    
    segments.push(`Participantes: ${participantes}`);
  }

  // Adicionar informações de local externo
  if (payload.externalLocation) {
    segments.push(`Local: Externo`);
    if (payload.distanceKm && payload.distanceKm > 0) {
      segments.push(`Distância: ${payload.distanceKm} km`);
    }
  }

  segments.push(`Tipo de agenda: ${payload.agendaType === "pessoal" ? "Pessoal" : "Compartilhada"}`);

  if (segments.length === 0) {
    return undefined;
  }

  return segments.join("\n\n");
}

async function getAccessToken(): Promise<string> {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error("Google service account credentials are not configured");
  }

  const formattedPrivateKey = GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");

  const auth = new GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: formattedPrivateKey,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error("Failed to obtain Google access token");
  }

  return accessToken.token;
}

function getDateTimeRange(
  payload: CalendarEventRequest
): { start: string; end: string; timeZone: string } {
  const timeZone = payload.timeZone || DEFAULT_TIME_ZONE;
  const start = DateTime.fromISO(`${payload.startDate}T${normalizeTime(payload.startTime)}`, {
    zone: timeZone,
  });

  if (!start.isValid) {
    throw new Error("Data ou horário inicial inválido para o Google Calendar");
  }

  let end: DateTime;

  if (payload.endTime) {
    end = DateTime.fromISO(`${payload.endDate}T${normalizeTime(payload.endTime)}`, {
      zone: timeZone,
    });
  } else {
    const endBase = payload.endDate ? DateTime.fromISO(`${payload.endDate}T${normalizeTime(payload.startTime)}`, {
      zone: timeZone,
    }) : start;
    end = endBase.plus({ hours: 1 });
  }

  if (!end.isValid) {
    throw new Error("Data ou horário final inválido para o Google Calendar");
  }

  if (end <= start) {
    end = start.plus({ hours: 1 });
  }

  return {
    start: start.toISO(),
    end: end.toISO(),
    timeZone,
  };
}

async function ensureUserAuthorized(authHeader: string | null) {
  if (!authHeader) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return data.user.id;
}

async function updateAgendaWithEvent(agendaId: string, eventId: string) {
  const { error } = await supabaseAdmin
    .from("agenda")
    .update({ google_event_id: eventId })
    .eq("id", agendaId);

  if (error) {
    console.error("Failed to update agenda with Google event ID", error);
  }
}

async function createCalendarEvent(payload: CalendarEventRequest, accessToken: string) {
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Google Calendar ID is not configured");
  }

  const { start, end, timeZone } = getDateTimeRange(payload);
  const description = buildDescription(payload);

  const eventBody = {
    summary: payload.title,
    description,
    location: payload.location || undefined,
    start: {
      dateTime: start,
      timeZone,
    },
    end: {
      dateTime: end,
      timeZone,
    },
    // NÃO incluir attendees devido à limitação da Service Account
    // Service accounts não podem convidar participantes sem Domain-Wide Delegation
    // attendees: payload.attendees?.map(attendee => ({
    //   email: attendee.email,
    //   displayName: attendee.displayName,
    // })),
    extendedProperties: {
      private: {
        agendaId: payload.agendaId,
        agendaType: payload.agendaType,
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
    console.error("Google Calendar API error", errorPayload);
    throw new Error("Falha ao criar evento no Google Calendar");
  }

  return (await response.json()) as { id: string; htmlLink?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await ensureUserAuthorized(req.headers.get("Authorization"));

    const payload = (await req.json()) as CalendarEventRequest;
    if (!payload?.agendaId || !payload.title || !payload.startDate || !payload.startTime || !payload.endDate) {
      return new Response(JSON.stringify({ error: "Dados insuficientes para criar o evento" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evita criar duplicados se o agendamento já possui um Google Event ID
    const { data: existingAgenda, error: fetchError } = await supabaseAdmin
      .from("agenda")
      .select("google_event_id")
      .eq("id", payload.agendaId)
      .single();

    if (fetchError) {
      console.error("Erro ao buscar agendamento para sincronização", fetchError);
    }

    if (existingAgenda?.google_event_id) {
      return new Response(
        JSON.stringify({
          eventId: existingAgenda.google_event_id,
          status: "skipped",
        } satisfies CalendarEventResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await getAccessToken();
    const createdEvent = await createCalendarEvent(payload, accessToken);

    await updateAgendaWithEvent(payload.agendaId, createdEvent.id);

    return new Response(
      JSON.stringify({
        eventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        status: "created",
      } satisfies CalendarEventResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro ao criar evento no Google Calendar", error);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
