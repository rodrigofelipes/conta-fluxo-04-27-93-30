import { supabase } from '@/integrations/supabase/client';

interface UpdateEventPayload {
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

interface DeleteEventPayload {
  agendaId: string;
  googleEventId: string;
}

export async function updateGoogleCalendarEvent(
  payload: UpdateEventPayload
): Promise<{ success: boolean; event?: any }> {
  const { data, error } = await supabase.functions.invoke('update-google-calendar-event', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteGoogleCalendarEvent(
  payload: DeleteEventPayload
): Promise<{ success: boolean }> {
  const { data, error } = await supabase.functions.invoke('delete-google-calendar-event', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  return data;
}