import { googleCalendarConfig } from '@/config/googleCalendar';
import { supabase } from '@/integrations/supabase/client';

export interface CalendarAttendee {
  email: string;
  displayName?: string;
}

export interface CreateCalendarEventPayload {
  agendaId: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  cliente?: string | null;
  agendaType: 'pessoal' | 'compartilhada';
  attendees?: CalendarAttendee[];
  externalLocation?: boolean;
  distanceKm?: number;
}

export interface CreateCalendarEventResponse {
  eventId: string;
  htmlLink?: string;
  status: 'created' | 'skipped';
}

export async function createGoogleCalendarEvent(
  payload: CreateCalendarEventPayload,
  options?: { signal?: AbortSignal }
): Promise<CreateCalendarEventResponse | null> {
  if (!googleCalendarConfig.enabled) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke<CreateCalendarEventResponse>(
    googleCalendarConfig.createEventFunction,
    {
      body: {
        ...payload,
        timeZone: googleCalendarConfig.defaultTimeZone,
      },
      signal: options?.signal,
    }
  );

  if (error) {
    throw error;
  }

  return data;
}
