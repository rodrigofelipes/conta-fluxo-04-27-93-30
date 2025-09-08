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
          descricao: string | null
          horario: string
          horario_fim: string | null
          id: string
          local: string | null
          tipo: string
          titulo: string
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
          descricao?: string | null
          horario: string
          horario_fim?: string | null
          id?: string
          local?: string | null
          tipo: string
          titulo: string
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
          descricao?: string | null
          horario?: string
          horario_fim?: string | null
          id?: string
          local?: string | null
          tipo?: string
          titulo?: string
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
          client_id: string
          created_at: string
          document_name: string
          document_type: string
          file_path: string | null
          file_size: number | null
          id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          created_at?: string
          document_name: string
          document_type: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          updated_at?: string
          uploaded_by?: string
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
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          meeting_type: Database["public"]["Enums"]["meeting_type"]
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          meeting_type?: Database["public"]["Enums"]["meeting_type"]
          start_date?: string
          title?: string
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
      profiles: {
        Row: {
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
          executed_hours: number | null
          id: string
          order_index: number
          phase_name: string
          project_id: string
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
          executed_hours?: number | null
          id?: string
          order_index?: number
          phase_name: string
          project_id: string
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
          executed_hours?: number | null
          id?: string
          order_index?: number
          phase_name?: string
          project_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      complete_phase: {
        Args: { phase_id_param: string; user_id_param: string }
        Returns: Json
      }
      exec_sql: {
        Args: { sql: string }
        Returns: undefined
      }
      get_restricted_profile_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_user_email_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_master_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_only_restricted_collaborators: {
        Args: { _collabs: string[] }
        Returns: boolean
      }
      manage_whatsapp_schedule: {
        Args: { new_schedule: string; user_id: string }
        Returns: Json
      }
      send_daily_whatsapp_agenda: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_daily_whatsapp: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
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
      user_role: "admin" | "supervisor" | "user" | "coordenador"
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
      user_role: ["admin", "supervisor", "user", "coordenador"],
    },
  },
} as const
