import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const GOOGLE_SERVICE_ACCOUNT = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface DeleteEventRequest {
  agendaId: string;
  googleEventId: string;
}

async function getAccessToken(): Promise<string> {
  if (!GOOGLE_SERVICE_ACCOUNT) {
    throw new Error("Google service account credentials are not configured");
  }

  let credentials;
  try {
    credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
  } catch (error) {
    throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT: ${error.message}`);
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
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

async function deleteCalendarEvent(eventId: string, accessToken: string): Promise<void> {
  if (!GOOGLE_CALENDAR_ID) {
    throw new Error("Google Calendar ID is not configured");
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 404 significa que o evento já foi deletado, o que é ok
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    console.error("Google Calendar API error:", error);
    throw new Error(`Falha ao deletar evento: ${error}`);
  }
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
    const payload = (await req.json()) as DeleteEventRequest;

    if (!payload.agendaId || !payload.googleEventId) {
      return new Response(
        JSON.stringify({ error: "agendaId e googleEventId são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken = await getAccessToken();
    await deleteCalendarEvent(payload.googleEventId, accessToken);

    // Log da sincronização
    await supabaseAdmin.from("google_calendar_sync_log").insert({
      agenda_id: payload.agendaId,
      google_event_id: payload.googleEventId,
      sync_direction: "system_to_google",
      sync_status: "success",
      operation: "delete",
      metadata: { deleted_at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro ao deletar evento no Google Calendar:", error);
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
