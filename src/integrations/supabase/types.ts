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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alert_attempts: {
        Row: {
          channel: string
          contact_id: string | null
          contact_name: string
          created_at: string
          event_id: string
          id: string
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          contact_id?: string | null
          contact_name: string
          created_at?: string
          event_id: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          contact_name?: string
          created_at?: string
          event_id?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_attempts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "alert_events"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_events: {
        Row: {
          accuracy: number | null
          cancel_deadline: string | null
          canceled_at: string | null
          created_at: string
          dispatch_started_at: string | null
          id: string
          idempotency_key: string
          is_demo: boolean
          last_error: string | null
          lat: number | null
          lng: number | null
          location_at: string | null
          location_source: string | null
          mode: string
          next_action_at: string | null
          reason_label: string
          reason_reading: string
          reason_type: string
          resolved_at: string | null
          round: number
          settings_snapshot: Json
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          is_demo?: boolean
          mode?: string
          reason_label: string
          reason_reading?: string
          reason_type: string
          started_at: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          is_demo?: boolean
          mode?: string
          reason_label?: string
          reason_reading?: string
          reason_type?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_settings: {
        Row: {
          automation_enabled: boolean
          consent_at: string | null
          countdown_seconds: number
          escalate_after_seconds: number
          identity_name: string
          include_location: boolean
          max_rounds: number
          test_mode: boolean
          triggers: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_enabled?: boolean
          consent_at?: string | null
          countdown_seconds?: number
          escalate_after_seconds?: number
          identity_name?: string
          include_location?: boolean
          max_rounds?: number
          test_mode?: boolean
          triggers?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_enabled?: boolean
          consent_at?: string | null
          countdown_seconds?: number
          escalate_after_seconds?: number
          identity_name?: string
          include_location?: boolean
          max_rounds?: number
          test_mode?: boolean
          triggers?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      care_events: {
        Row: {
          color: string
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          automation_consent: boolean
          call: boolean
          confirmed_at: string | null
          consent_at: string | null
          consent_note: string
          created_at: string
          email: string | null
          email_alerts: boolean
          id: string
          name: string
          phone: string
          position: number
          relationship: string
          sms: boolean
          test_destination: boolean
          user_id: string
        }
        Insert: {
          automation_consent?: boolean
          call?: boolean
          confirmed_at?: string | null
          consent_at?: string | null
          consent_note?: string
          created_at?: string
          email?: string | null
          email_alerts?: boolean
          id?: string
          name: string
          phone: string
          position?: number
          relationship?: string
          sms?: boolean
          test_destination?: boolean
          user_id: string
        }
        Update: {
          automation_consent?: boolean
          call?: boolean
          confirmed_at?: string | null
          consent_at?: string | null
          consent_note?: string
          created_at?: string
          email?: string | null
          email_alerts?: boolean
          id?: string
          name?: string
          phone?: string
          position?: number
          relationship?: string
          sms?: boolean
          test_destination?: boolean
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          accuracy: number | null
          id: string
          lat: number | null
          lng: number | null
          location_at: string | null
          reading: string
          reason: string
          resolved_at: string | null
          share_token: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          reading?: string
          reason: string
          resolved_at?: string | null
          share_token?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_at?: string | null
          reading?: string
          reason?: string
          resolved_at?: string | null
          share_token?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_progress: {
        Row: {
          attempts: number
          best_safe: number
          created_at: string
          last_practised_at: string
          scenario_id: string
          status: string
          total_decisions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_safe?: number
          created_at?: string
          last_practised_at?: string
          scenario_id: string
          status: string
          total_decisions?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          attempts?: number
          best_safe?: number
          created_at?: string
          last_practised_at?: string
          scenario_id?: string
          status?: string
          total_decisions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          allergies: string[]
          blood_type: string
          conditions: string[]
          full_name: string
          id: string
          medications: string[]
          updated_at: string
        }
        Insert: {
          age?: number | null
          allergies?: string[]
          blood_type?: string
          conditions?: string[]
          full_name?: string
          id: string
          medications?: string[]
          updated_at?: string
        }
        Update: {
          age?: number | null
          allergies?: string[]
          blood_type?: string
          conditions?: string[]
          full_name?: string
          id?: string
          medications?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      safety_preferences: {
        Row: {
          consent_at: string | null
          dispatch_consent: boolean
          language: string
          share_location: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_at?: string | null
          dispatch_consent?: boolean
          language?: string
          share_location?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_at?: string | null
          dispatch_consent?: boolean
          language?: string
          share_location?: boolean
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
      clear_my_safety_data: { Args: never; Returns: undefined }
      get_shared_incident: {
        Args: { _token: string }
        Returns: {
          accuracy: number
          age: number
          allergies: string[]
          blood_type: string
          conditions: string[]
          full_name: string
          lat: number
          lng: number
          location_at: string
          medications: string[]
          reading: string
          reason: string
          resolved_at: string
          started_at: string
          status: string
        }[]
      }
      replace_my_contacts: { Args: { _contacts: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
