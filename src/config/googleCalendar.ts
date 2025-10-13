export interface GoogleCalendarConfig {
  createEventFunction: string;
  defaultTimeZone: string;
  enabled: boolean;
}

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const ENABLED_FLAG = import.meta.env.VITE_ENABLE_GOOGLE_CALENDAR_SYNC === 'true';

export const googleCalendarConfig: GoogleCalendarConfig = {
  createEventFunction: 'create-google-calendar-event',
  defaultTimeZone: import.meta.env.VITE_GOOGLE_CALENDAR_TIMEZONE || DEFAULT_TIME_ZONE,
  enabled: ENABLED_FLAG,
};
