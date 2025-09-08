export { supabase } from '@/integrations/supabase/client';
export type Database = {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          message: string;
          created_at: string;
          from_user_name: string;
          to_user_name: string;
          viewed_at: string | null;
          message_type?: string;
        };
        Insert: {
          from_user_id: string;
          to_user_id: string;
          message: string;
          from_user_name: string;
          to_user_name: string;
          message_type?: string;
        };
        Update: {
          from_user_id?: string;
          to_user_id?: string;
          message?: string;
          from_user_name?: string;
          to_user_name?: string;
          viewed_at?: string | null;
          message_type?: string;
        };
      };
    };
    Functions: {
      get_user_email_by_username: {
        Args: { username_input: string };
        Returns: string;
      };
      promote_user_by_username_to_admin: {
        Args: { username_input: string };
        Returns: boolean;
      };
      reset_user_password_by_username: {
        Args: { username_input: string; new_password: string };
        Returns: boolean;
      };
      mark_messages_as_viewed: {
        Args: { viewer_id: string; sender_id: string };
        Returns: void;
      };
    };
  };
};