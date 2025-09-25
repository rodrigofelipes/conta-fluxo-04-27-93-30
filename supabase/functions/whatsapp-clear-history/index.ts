import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ClientContactRow = { id: string };
type AttachmentRow = { id: string; file_path: string | null };

type ClearConversationPayload = {
  clientId?: string;
};

type FailedStorageRemoval = {
  path: string;
  error: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for whatsapp-clear-history function.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  let payload: ClearConversationPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const clientId = payload?.clientId;

  if (!clientId || typeof clientId !== "string" || clientId.trim().length === 0) {
    return jsonResponse(
      { success: false, error: "clientId is required" },
      { status: 400 },
    );
  }

  try {
    const { data: contacts, error: contactsError } = await supabase
      .from("client_contacts")
      .select("id")
      .eq("client_id", clientId)
      .eq("contact_type", "whatsapp");

    if (contactsError) {
      throw contactsError;
    }

    const messageIds = (contacts as ClientContactRow[] | null)?.map((row) => row.id) ?? [];

    let attachmentsDeleted = 0;
    let storageRemoved = 0;
    const failedStorage: FailedStorageRemoval[] = [];

    if (messageIds.length > 0) {
      const { data: attachments, error: attachmentsError } = await supabase
        .from("message_attachments")
        .select("id, file_path")
        .in("message_id", messageIds);

      if (attachmentsError) {
        throw attachmentsError;
      }

      const attachmentRows = (attachments as AttachmentRow[] | null) ?? [];

      const uniquePaths = Array.from(
        new Set(
          attachmentRows
            .map((attachment) => attachment.file_path)
            .filter((path): path is string => typeof path === "string" && path.length > 0),
        ),
      );

      for (const path of uniquePaths) {
        const { error: removeError } = await supabase.storage.from("chat-files").remove([path]);
        if (removeError) {
          console.error("Failed to remove storage object", { path, error: removeError });
          failedStorage.push({
            path,
            error: removeError.message ?? String(removeError),
          });
        } else {
          storageRemoved += 1;
        }
      }

      if (attachmentRows.length > 0) {
        const attachmentIds = attachmentRows.map((attachment) => attachment.id);
        const { error: deleteAttachmentsError } = await supabase
          .from("message_attachments")
          .delete()
          .in("id", attachmentIds);

        if (deleteAttachmentsError) {
          throw deleteAttachmentsError;
        }

        attachmentsDeleted = attachmentIds.length;
      }
    }

    const { data: deletedContacts, error: deleteContactsError } = await supabase
      .from("client_contacts")
      .delete()
      .eq("client_id", clientId)
      .eq("contact_type", "whatsapp")
      .select("id");

    if (deleteContactsError) {
      throw deleteContactsError;
    }

    const contactsDeleted = (deletedContacts as ClientContactRow[] | null)?.length ?? 0;

    return jsonResponse(
      {
        success: failedStorage.length === 0,
        contactsDeleted,
        attachmentsDeleted,
        storageRemoved,
        failedStorage: failedStorage.length > 0 ? failedStorage : undefined,
      },
      { status: failedStorage.length === 0 ? 200 : 207 },
    );
  } catch (error) {
    console.error("Error clearing WhatsApp conversation", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
