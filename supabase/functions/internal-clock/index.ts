// Internal clocker edge function: checks Brazil time and triggers the daily WhatsApp agenda
// Uses a daily lock to avoid duplicate sends

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBrazilNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");

  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD in Brazil TZ
  return { year, month, day, hour, minute, dateStr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing Supabase env vars" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
  });

  try {
    const { hour, minute, dateStr } = getBrazilNow();

    // Load configured schedule from system settings (format: "m h * * *")
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "whatsapp_agenda_schedule")
      .maybeSingle();

    if (settingError) {
      console.error("[internal-clock] Error reading system_settings:", settingError);
      return new Response(
        JSON.stringify({ ok: false, error: "settings_read_failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!setting?.setting_value) {
      console.log("[internal-clock] No schedule configured. Skipping.");
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "no_schedule" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse cron "m h * * *"
    const parts = setting.setting_value.split(" ");
    if (parts.length < 2) {
      console.warn("[internal-clock] Invalid cron format:", setting.setting_value);
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_cron" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const cronMinute = parts[0].padStart(2, "0");
    const cronHour = parts[1].padStart(2, "0");

    const nowMinute = String(parseInt(minute, 10)).padStart(2, "0");
    const nowHour = String(parseInt(hour, 10)).padStart(2, "0");

    const match = cronMinute === nowMinute && cronHour === nowHour;

    if (!match) {
      return new Response(
        JSON.stringify({ ok: true, tick: true, match: false, now: `${nowHour}:${nowMinute}` }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Multiple sends allowed: no daily lock
    console.log("[internal-clock] Match time and multiple sends allowed. Invoking agenda...");

    // Invoke the daily WhatsApp agenda function
    const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
      "daily-whatsapp-agenda",
      {
        body: { scheduled: true, trigger: "internal-clock" },
      }
    );

    if (invokeError) {
      console.error("[internal-clock] Error invoking daily-whatsapp-agenda:", invokeError);
      return new Response(
        JSON.stringify({ ok: false, error: "invoke_failed", details: invokeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, executed: true, result: invokeData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error("[internal-clock] Unexpected error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "unexpected" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
