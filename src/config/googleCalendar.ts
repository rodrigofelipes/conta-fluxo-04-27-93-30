export interface GoogleCalendarConfig {
  createEventFunction: string;
  defaultTimeZone: string;
  enabled: boolean;
}

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export const googleCalendarConfig: GoogleCalendarConfig = {
  createEventFunction: 'create-google-calendar-event',
  defaultTimeZone: DEFAULT_TIME_ZONE,
  enabled: true, // Sempre habilitado
};
