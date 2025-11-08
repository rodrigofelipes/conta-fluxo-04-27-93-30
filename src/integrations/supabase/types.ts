export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agenda: {
        Row: {
          agenda_type: string | null
          cliente: string
          collaborators_ids: string[] | null
          created_at: string
          created_by: string
          data: string
          data_fim: string | null
          descricao: string | null
          distance_km: number | null
          external_location: boolean | null
          google_calendar_synced_at: string | null
          google_event_id: string | null
          horario: string
          horario_fim: string | null
          id: string
          local: string | null
          tipo: string
          titulo: string
          travel_cost: number | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          agenda_type?: string | null
          cliente: string
          collaborators_ids?: string[] | null
          created_at?: string
          created_by: string
          data: string
          data_fim?: string | null
          descricao?: string | null
          distance_km?: number | null
          external_location?: boolean | null
          google_calendar_synced_at?: string | null
          google_event_id?: string | null
          horario: string
          horario_fim?: string | null
          id?: string
          local?: string | null
          tipo: string
          titulo: string
          travel_cost?: number | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          agenda_type?: string | null
          cliente?: string
          collaborators_ids?: string[] | null
          created_at?: string
          created_by?: string
          data?: string
          data_fim?: string | null
          descricao?: string | null
          distance_km?: number | null
          external_location?: boolean | null
          google_calendar_synced_at?: string | null
          google_event_id?: string | null
          horario?: string
          horario_fim?: string | null
          id?: string
          local?: string | null
          tipo?: string
          titulo?: string
          travel_cost?: number | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_type: string
          balance: number | null
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          account_type: string
          balance?: number | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          balance?: number | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_budgets: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          description: string | null
          estimated_hours: number | null
          id: string
          items: Json | null
          project_id: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          items?: Json | null
          project_id?: string | null
          status?: string
          title: string
          total_amount: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_hours?: number | null
          id?: string
          items?: Json | null
          project_id?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          contact_date: string
          contact_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          subject: string
          updated_at: string
        }
        Insert: {
          client_id: string
          contact_date?: string
          contact_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          subject: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          contact_date?: string
          contact_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          chunks_uploaded: number | null
          client_id: string
          created_at: string
          document_name: string
          document_type: string
          file_hash: string | null
          file_path: string | null
          file_size: number | null
          id: string
          total_chunks: number | null
          updated_at: string
          upload_completed_at: string | null
          upload_progress: number | null
          upload_started_at: string | null
          upload_status: string | null
          uploaded_by: string
          verification_metadata: Json | null
          verified_at: string | null
        }
        Insert: {
          chunks_uploaded?: number | null
          client_id: string
          created_at?: string
          document_name: string
          document_type: string
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          total_chunks?: number | null
          updated_at?: string
          upload_completed_at?: string | null
          upload_progress?: number | null
          upload_started_at?: string | null
          upload_status?: string | null
          uploaded_by: string
          verification_metadata?: Json | null
          verified_at?: string | null
        }
        Update: {
          chunks_uploaded?: number | null
          client_id?: string
          created_at?: string
          document_name?: string
          document_type?: string
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          total_chunks?: number | null
          updated_at?: string
          upload_completed_at?: string | null
          upload_progress?: number | null
          upload_started_at?: string | null
          upload_status?: string | null
          uploaded_by?: string
          verification_metadata?: Json | null
          verified_at?: string | null
        }
        Relationships: []
      }
      client_financials: {
        Row: {
          amount: number
          bank_account_id: string | null
          client_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          parent_transaction_id: string | null
          payment_date: string | null
          payment_method: string | null
          project_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          reference_document: string | null
          status: string
          transaction_category: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          client_id: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          parent_transaction_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          reference_document?: string | null
          status?: string
          transaction_category?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          parent_transaction_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          reference_document?: string | null
          status?: string
          transaction_category?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          author_id: string
          client_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          client_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          classification: Database["public"]["Enums"]["client_classification"]
          construction_address: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          indication: string | null
          name: string
          phone: string | null
          residential_address: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          classification?: Database["public"]["Enums"]["client_classification"]
          construction_address?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          indication?: string | null
          name: string
          phone?: string | null
          residential_address?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          classification?: Database["public"]["Enums"]["client_classification"]
          construction_address?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          indication?: string | null
          name?: string
          phone?: string | null
          residential_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_execution_locks: {
        Row: {
          created_at: string | null
          executed_by: string
          execution_date: string
          id: string
          lock_key: string
        }
        Insert: {
          created_at?: string | null
          executed_by: string
          execution_date: string
          id?: string
          lock_key: string
        }
        Update: {
          created_at?: string | null
          executed_by?: string
          execution_date?: string
          id?: string
          lock_key?: string
        }
        Relationships: []
      }
      daily_whatsapp_log: {
        Row: {
          appointments_count: number
          created_at: string
          delivery_date: string
          error_details: Json | null
          id: string
          message_content: string | null
          updated_at: string
          user_name: string
          whatsapp_status: string
        }
        Insert: {
          appointments_count?: number
          created_at?: string
          delivery_date?: string
          error_details?: Json | null
          id?: string
          message_content?: string | null
          updated_at?: string
          user_name: string
          whatsapp_status?: string
        }
        Update: {
          appointments_count?: number
          created_at?: string
          delivery_date?: string
          error_details?: Json | null
          id?: string
          message_content?: string | null
          updated_at?: string
          user_name?: string
          whatsapp_status?: string
        }
        Relationships: []
      }
      document_events_log: {
        Row: {
          created_at: string | null
          document_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_events_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_share_tokens: {
        Row: {
          access_count: number | null
          created_at: string | null
          created_by: string
          document_id: string
          expires_at: string
          id: string
          last_accessed_at: string | null
          revoked_at: string | null
          scope: string | null
          token: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          created_by: string
          document_id: string
          expires_at: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string | null
          token: string
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          created_by?: string
          document_id?: string
          expires_at?: string
          id?: string
          last_accessed_at?: string | null
          revoked_at?: string | null
          scope?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_share_tokens_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          payment_method: string | null
          recurrence_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          created_by: string
          description: string
          expense_date?: string
          id?: string
          payment_method?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          payment_method?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          category_type: string
          created_at: string
          created_by: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          category_type: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_sync_log: {
        Row: {
          agenda_id: string | null
          error_message: string | null
          google_event_id: string
          id: string
          metadata: Json | null
          operation: string
          sync_direction: string
          sync_status: string
          synced_at: string | null
        }
        Insert: {
          agenda_id?: string | null
          error_message?: string | null
          google_event_id: string
          id?: string
          metadata?: Json | null
          operation: string
          sync_direction: string
          sync_status: string
          synced_at?: string | null
        }
        Update: {
          agenda_id?: string | null
          error_message?: string | null
          google_event_id?: string
          id?: string
          metadata?: Json | null
          operation?: string
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_sync_log_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      google_drive_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      group_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          updated_at?: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          is_national: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          date: string
          description?: string | null
          id?: string
          is_national?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          is_national?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      master_admins: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_atas: {
        Row: {
          action_items: Json | null
          agenda_id: string | null
          audio_file_url: string | null
          audio_size_bytes: number | null
          consent_obtained: boolean
          consented_at: string | null
          created_at: string | null
          created_by: string
          decisions: Json | null
          duration_minutes: number
          id: string
          meeting_date: string
          processed_summary: string | null
          retention_until: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          action_items?: Json | null
          agenda_id?: string | null
          audio_file_url?: string | null
          audio_size_bytes?: number | null
          consent_obtained?: boolean
          consented_at?: string | null
          created_at?: string | null
          created_by: string
          decisions?: Json | null
          duration_minutes: number
          id?: string
          meeting_date: string
          processed_summary?: string | null
          retention_until?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          action_items?: Json | null
          agenda_id?: string | null
          audio_file_url?: string | null
          audio_size_bytes?: number | null
          consent_obtained?: boolean
          consented_at?: string | null
          created_at?: string | null
          created_by?: string
          decisions?: Json | null
          duration_minutes?: number
          id?: string
          meeting_date?: string
          processed_summary?: string | null
          retention_until?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_atas_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_atas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          meeting_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          meeting_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          meeting_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          distance_km: number | null
          end_date: string
          external_location: boolean | null
          id: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          start_date: string
          title: string
          travel_cost: number | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          distance_km?: number | null
          end_date: string
          external_location?: boolean | null
          id?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_date: string
          title: string
          travel_cost?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          distance_km?: number | null
          end_date?: string
          external_location?: boolean | null
          id?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_date?: string
          title?: string
          travel_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          message_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          message_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          message_id?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          from_user_id: string
          from_user_name: string
          id: string
          message: string
          message_type: string
          to_user_id: string
          to_user_name: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          from_user_id: string
          from_user_name?: string
          id?: string
          message: string
          message_type?: string
          to_user_id: string
          to_user_name?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          from_user_id?: string
          from_user_name?: string
          id?: string
          message?: string
          message_type?: string
          to_user_id?: string
          to_user_name?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      overdue_expense_notifications: {
        Row: {
          client_id: string
          created_at: string | null
          due_date: string
          email_sent_at: string | null
          email_sent_by: string | null
          expense_count: number
          expense_ids: string[]
          id: string
          notification_date: string
          status: string
          total_amount: number
          updated_at: string | null
          whatsapp_message_id: string | null
          whatsapp_sent_at: string | null
          whatsapp_sent_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          due_date: string
          email_sent_at?: string | null
          email_sent_by?: string | null
          expense_count: number
          expense_ids: string[]
          id?: string
          notification_date: string
          status?: string
          total_amount: number
          updated_at?: string | null
          whatsapp_message_id?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_sent_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          due_date?: string
          email_sent_at?: string | null
          email_sent_by?: string | null
          expense_count?: number
          expense_ids?: string[]
          id?: string
          notification_date?: string
          status?: string
          total_amount?: number
          updated_at?: string | null
          whatsapp_message_id?: string | null
          whatsapp_sent_at?: string | null
          whatsapp_sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "overdue_expense_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_expense_notifications_email_sent_by_fkey"
            columns: ["email_sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overdue_expense_notifications_whatsapp_sent_by_fkey"
            columns: ["whatsapp_sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string
          due_date: string
          financial_transaction_id: string | null
          id: string
          installment_number: number
          payment_date: string | null
          payment_method: string | null
          status: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by: string
          due_date: string
          financial_transaction_id?: string | null
          id?: string
          installment_number: number
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          total_installments: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          financial_transaction_id?: string | null
          id?: string
          installment_number?: number
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string
          expires_at: string
          financial_transaction_id: string | null
          id: string
          installment_id: string | null
          link_token: string
          paid_at: string | null
          status: string
          stripe_checkout_url: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          expires_at: string
          financial_transaction_id?: string | null
          id?: string
          installment_id?: string | null
          link_token: string
          paid_at?: string | null
          status?: string
          stripe_checkout_url?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          expires_at?: string
          financial_transaction_id?: string | null
          id?: string
          installment_id?: string | null
          link_token?: string
          paid_at?: string | null
          status?: string
          stripe_checkout_url?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "client_financials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "payment_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_status_changes: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          old_status: string
          phase_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          old_status: string
          phase_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          old_status?: string
          phase_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_status_changes_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          gradient: string | null
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          telefone: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          gradient?: string | null
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          gradient?: string | null
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          telefone?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_path: string
          file_size: number
          id: string
          project_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_path: string
          file_size: number
          id?: string
          project_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number
          id?: string
          project_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      project_phases: {
        Row: {
          allocated_hours: number
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          executed_hours: number | null
          id: string
          order_index: number
          phase_name: string
          priority: string | null
          project_id: string
          start_date: string | null
          status: string
          supervised_by: string | null
          updated_at: string
          value_percentage: number
        }
        Insert: {
          allocated_hours?: number
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          executed_hours?: number | null
          id?: string
          order_index?: number
          phase_name: string
          priority?: string | null
          project_id: string
          start_date?: string | null
          status?: string
          supervised_by?: string | null
          updated_at?: string
          value_percentage?: number
        }
        Update: {
          allocated_hours?: number
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          executed_hours?: number | null
          id?: string
          order_index?: number
          phase_name?: string
          priority?: string | null
          project_id?: string
          start_date?: string | null
          status?: string
          supervised_by?: string | null
          updated_at?: string
          value_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_assigned_to"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_phases_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supervised_by"
            columns: ["supervised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          briefing_document: string | null
          client_id: string
          contracted_hours: number | null
          contracted_value: number
          created_at: string
          created_by: string | null
          description: string | null
          executed_hours: number | null
          id: string
          meetings_count: number | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
          visits_count: number | null
        }
        Insert: {
          address?: string | null
          briefing_document?: string | null
          client_id: string
          contracted_hours?: number | null
          contracted_value?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          executed_hours?: number | null
          id?: string
          meetings_count?: number | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
          visits_count?: number | null
        }
        Update: {
          address?: string | null
          briefing_document?: string | null
          client_id?: string
          contracted_hours?: number | null
          contracted_value?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          executed_hours?: number | null
          id?: string
          meetings_count?: number | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          visits_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings_log: {
        Row: {
          changed_at: string
          changed_by: string
          description: string | null
          id: string
          new_value: string
          old_value: string | null
          setting_key: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          description?: string | null
          id?: string
          new_value: string
          old_value?: string | null
          setting_key: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          description?: string | null
          id?: string
          new_value?: string
          old_value?: string | null
          setting_key?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          phase_id: string | null
          project_id: string
          start_time: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          phase_id?: string | null
          project_id: string
          start_time: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          phase_id?: string | null
          project_id?: string
          start_time?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_phase_id"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      upload_metrics: {
        Row: {
          chunks_count: number | null
          client_id: string | null
          created_at: string | null
          document_id: string | null
          error_message: string | null
          file_size: number
          hash_duration_ms: number | null
          id: string
          retry_count: number | null
          success: boolean
          upload_duration_ms: number | null
          upload_method: string
          upload_speed_mbps: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          chunks_count?: number | null
          client_id?: string | null
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_size: number
          hash_duration_ms?: number | null
          id?: string
          retry_count?: number | null
          success: boolean
          upload_duration_ms?: number | null
          upload_method: string
          upload_speed_mbps?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          chunks_count?: number | null
          client_id?: string | null
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_size?: number
          hash_duration_ms?: number | null
          id?: string
          retry_count?: number | null
          success?: boolean
          upload_duration_ms?: number | null
          upload_method?: string
          upload_speed_mbps?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_metrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_metrics_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "client_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          notification_sent_at: string | null
          threshold_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          notification_sent_at?: string | null
          threshold_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notification_sent_at?: string | null
          threshold_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      utterances: {
        Row: {
          ata_id: string
          confidence_score: number | null
          created_at: string | null
          diar_label: string
          end_ms: number
          id: string
          identified_name: string | null
          person_id: string | null
          start_ms: number
          transcript: string
        }
        Insert: {
          ata_id: string
          confidence_score?: number | null
          created_at?: string | null
          diar_label: string
          end_ms: number
          id?: string
          identified_name?: string | null
          person_id?: string | null
          start_ms: number
          transcript: string
        }
        Update: {
          ata_id?: string
          confidence_score?: number | null
          created_at?: string | null
          diar_label?: string
          end_ms?: number
          id?: string
          identified_name?: string | null
          person_id?: string | null
          start_ms?: number
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "utterances_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "meeting_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utterances_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_profiles: {
        Row: {
          created_at: string | null
          id: string
          last_updated: string | null
          person_id: string
          samples_count: number | null
          similarity_threshold: number | null
          voice_embedding: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          person_id: string
          samples_count?: number | null
          similarity_threshold?: number | null
          voice_embedding?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_updated?: string | null
          person_id?: string
          samples_count?: number | null
          similarity_threshold?: number | null
          voice_embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          id: string
          phone_number: string
          selected_option: string | null
          state: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          phone_number: string
          selected_option?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          phone_number?: string
          selected_option?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_update_phase_status_by_date: {
        Args: never
        Returns: {
          phase_ids: string[]
          updated_count: number
        }[]
      }
      calculate_client_storage_usage: {
        Args: { client_id_param: string }
        Returns: number
      }
      calculate_phase_loss: {
        Args: { phase_id_param: string }
        Returns: {
          excess_hours: number
          hourly_value: number
          loss_percentage: number
          total_loss: number
        }[]
      }
      can_manage_phase: {
        Args: { phase_id_param: string; user_id_param: string }
        Returns: boolean
      }
      cleanup_orphaned_uploads: {
        Args: never
        Returns: {
          expired_tokens_count: number
          incomplete_uploads_count: number
          orphaned_files_count: number
        }[]
      }
      complete_phase: {
        Args: { phase_id_param: string; user_id_param: string }
        Returns: Json
      }
      exec_sql: { Args: { sql: string }; Returns: undefined }
      get_overdue_expenses_for_notification: {
        Args: never
        Returns: {
          client_id: string
          due_date: string
          expense_count: number
          expense_ids: string[]
          total_amount: number
        }[]
      }
      get_restricted_profile_ids: { Args: never; Returns: string[] }
      get_user_email_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      has_valid_session: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_master_admin: { Args: never; Returns: boolean }
      is_only_restricted_collaborators: {
        Args: { _collabs: string[] }
        Returns: boolean
      }
      manage_whatsapp_schedule: {
        Args: { new_schedule: string; user_id: string }
        Returns: Json
      }
      match_voice_profile: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          identified_name: string
          person_id: string
          similarity: number
        }[]
      }
      phase_has_time_entries: {
        Args: { phase_id_param: string }
        Returns: boolean
      }
      purge_expired_atas: {
        Args: never
        Returns: {
          purged_audio_paths: string[]
          purged_count: number
        }[]
      }
      send_daily_whatsapp_agenda: { Args: never; Returns: Json }
      trigger_daily_whatsapp: { Args: never; Returns: Json }
      user_can_work_on_phase: {
        Args: { phase_id_param: string; user_id_param: string }
        Returns: boolean
      }
    }
    Enums: {
      client_classification: "cliente" | "colaborador" | "fornecedor"
      meeting_type:
        | "reunião"
        | "visita"
        | "apresentação"
        | "aprovação"
        | "entrega"
      project_status:
        | "orçamento"
        | "aguardando_retorno"
        | "em_andamento"
        | "em_obra"
        | "concluído"
      task_priority: "baixa" | "média" | "alta" | "urgente"
      task_status: "pendente" | "em_andamento" | "concluída"
      user_role: "admin" | "supervisor" | "user" | "coordenador" | "marketing"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      client_classification: ["cliente", "colaborador", "fornecedor"],
      meeting_type: [
        "reunião",
        "visita",
        "apresentação",
        "aprovação",
        "entrega",
      ],
      project_status: [
        "orçamento",
        "aguardando_retorno",
        "em_andamento",
        "em_obra",
        "concluído",
      ],
      task_priority: ["baixa", "média", "alta", "urgente"],
      task_status: ["pendente", "em_andamento", "concluída"],
      user_role: ["admin", "supervisor", "user", "coordenador", "marketing"],
    },
  },
} as const
