-- Add Google Calendar event tracking to agenda items
ALTER TABLE public.agenda
ADD COLUMN IF NOT EXISTS google_event_id text;

CREATE INDEX IF NOT EXISTS idx_agenda_google_event_id ON public.agenda(google_event_id);
