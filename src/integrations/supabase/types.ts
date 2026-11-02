export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      contacts: {
        Row: {
          call: boolean;
          confirmed_at: string | null;
          created_at: string;
          email: string;
          email_alerts: boolean;
          id: string;
          name: string;
          phone: string;
          position: number;
          relationship: string;
          sms: boolean;
          test_destination: boolean;
          user_id: string;
        };
        Insert: {
          call?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string;
          email_alerts?: boolean;
          id?: string;
          name: string;
          phone: string;
          position?: number;
          relationship?: string;
          sms?: boolean;
          test_destination?: boolean;
          user_id: string;
        };
        Update: {
          call?: boolean;
          confirmed_at?: string | null;
          created_at?: string;
          email?: string;
          email_alerts?: boolean;
          id?: string;
          name?: string;
          phone?: string;
          position?: number;
          relationship?: string;
          sms?: boolean;
          test_destination?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          accuracy: number | null;
          id: string;
          lat: number | null;
          lng: number | null;
          location_at: string | null;
          reading: string;
          reason: string;
          resolved_at: string | null;
          share_token: string;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          accuracy?: number | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          location_at?: string | null;
          reading?: string;
          reason: string;
          resolved_at?: string | null;
          share_token?: string;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          accuracy?: number | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          location_at?: string | null;
          reading?: string;
          reason?: string;
          resolved_at?: string | null;
          share_token?: string;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      alert_attempts: {
        Row: {
          acknowledged_at: string | null;
          address: string;
          attempted_at: string | null;
          channel: string;
          contact_id: string | null;
          contact_name: string;
          created_at: string;
          detail: string;
          event_id: string;
          id: string;
          next_retry_at: string | null;
          priority: number;
          provider: string;
          provider_ref: string | null;
          retry_count: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          address?: string;
          attempted_at?: string | null;
          channel: string;
          contact_id?: string | null;
          contact_name: string;
          created_at?: string;
          detail?: string;
          event_id: string;
          id?: string;
          next_retry_at?: string | null;
          priority?: number;
          provider?: string;
          provider_ref?: string | null;
          retry_count?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          address?: string;
          attempted_at?: string | null;
          channel?: string;
          contact_id?: string | null;
          contact_name?: string;
          detail?: string;
          next_retry_at?: string | null;
          priority?: number;
          provider?: string;
          provider_ref?: string | null;
          retry_count?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alert_events: {
        Row: {
          accuracy: number | null;
          acknowledged_at: string | null;
          cancelled_at: string | null;
          id: string;
          idempotency_key: string;
          is_demo: boolean;
          lat: number | null;
          lng: number | null;
          location_at: string | null;
          mode: string;
          policy: Json;
          reason_label: string;
          reason_reading: string;
          reason_type: string;
          share_token: string;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          accuracy?: number | null;
          acknowledged_at?: string | null;
          cancelled_at?: string | null;
          id?: string;
          idempotency_key: string;
          is_demo?: boolean;
          lat?: number | null;
          lng?: number | null;
          location_at?: string | null;
          mode?: string;
          policy?: Json;
          reason_label: string;
          reason_reading?: string;
          reason_type: string;
          share_token?: string;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          accuracy?: number | null;
          acknowledged_at?: string | null;
          cancelled_at?: string | null;
          lat?: number | null;
          lng?: number | null;
          location_at?: string | null;
          mode?: string;
          policy?: Json;
          reason_label?: string;
          reason_reading?: string;
          reason_type?: string;
          share_token?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          age: number | null;
          allergies: string[];
          blood_type: string;
          conditions: string[];
          full_name: string;
          id: string;
          medications: string[];
          updated_at: string;
        };
        Insert: {
          age?: number | null;
          allergies?: string[];
          blood_type?: string;
          conditions?: string[];
          full_name?: string;
          id: string;
          medications?: string[];
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          allergies?: string[];
          blood_type?: string;
          conditions?: string[];
          full_name?: string;
          id?: string;
          medications?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      safety_preferences: {
        Row: {
          consent_at: string | null;
          created_at: string;
          dispatch_consent: boolean;
          language: string;
          share_location: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          consent_at?: string | null;
          created_at?: string;
          dispatch_consent?: boolean;
          language?: string;
          share_location?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          consent_at?: string | null;
          dispatch_consent?: boolean;
          language?: string;
          share_location?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      acknowledge_alert: { Args: { _token: string }; Returns: boolean };
      clear_my_safety_data: { Args: never; Returns: undefined };
      get_shared_incident: {
        Args: { _token: string };
        Returns: {
          accuracy: number;
          age: number;
          allergies: string[];
          blood_type: string;
          conditions: string[];
          full_name: string;
          lat: number;
          lng: number;
          location_at: string;
          medications: string[];
          reading: string;
          reason: string;
          resolved_at: string;
          started_at: string;
          status: string;
        }[];
      };
      replace_my_contacts: { Args: { _contacts: Json }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
