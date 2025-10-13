import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.14.1";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GOOGLE_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

  if (!accessToken) {
    throw new Error("Failed to obtain Google access token");
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
    errors: 0,
  };

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
      
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      const agendaData = {
        titulo: event.summary || "Sem título",
        descricao: event.description || null,
        data: startDate.toISOString().split("T")[0],
        data_fim: endDate.toISOString().split("T")[0],
        horario: event.start.dateTime ? startDate.toTimeString().split(" ")[0] : "00:00:00",
        horario_fim: event.end?.dateTime ? endDate.toTimeString().split(" ")[0] : null,
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
        // Precisamos de um created_by válido - vamos usar o primeiro admin
        const { data: adminProfile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();

        if (!adminProfile) {
          console.error("No admin user found to create agenda item");
          syncResults.errors++;
          continue;
        }

        const { data: created, error } = await supabaseAdmin
          .from("agenda")
          .insert({
            ...agendaData,
            created_by: adminProfile.user_id,
            collaborators_ids: [],
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
