import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, active } = await req.json().catch(() => ({}));

    if (!userId || typeof active !== "boolean") {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client (service role) for privileged updates
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticated client to identify the caller (uses caller JWT)
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Identify caller
    const { data: callerUser, error: callerErr } = await caller.auth.getUser();
    if (callerErr || !callerUser?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller role
    const { data: callerProfile, error: profileErr } = await caller
      .from("profiles")
      .select("role")
      .eq("user_id", callerUser.user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("Erro buscando perfil do solicitante:", profileErr);
      return new Response(JSON.stringify({ error: "Falha ao validar permissões" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = callerProfile?.role as string | undefined;
    if (!(role === "admin" || role === "supervisor")) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profiles.active
    const { data: updatedProfile, error: updErr } = await admin
      .from("profiles")
      .update({ active })
      .eq("user_id", userId)
      .select("id, active")
      .maybeSingle();

    if (updErr || !updatedProfile) {
      console.error("Erro atualizando perfil:", updErr);
      return new Response(JSON.stringify({ error: "Falha ao atualizar perfil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ban/Unban at auth level to block logins immediately
    const ban_duration = active ? "none" : "876000h"; // ~100 anos
    const { data: adminUpdate, error: adminErr } = await admin.auth.admin.updateUserById(
      userId,
      { ban_duration }
    );

    if (adminErr) {
      console.error("Erro ao aplicar banimento no auth:", adminErr);
      // Not a hard failure: continue, as profiles.active still updated
    }

    return new Response(
      JSON.stringify({ success: true, active: updatedProfile.active, auth: adminUpdate ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("toggle-user-status error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});