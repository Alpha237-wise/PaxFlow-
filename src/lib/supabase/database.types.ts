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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crossings: {
        Row: {
          ab_name: string | null
          captain_on_board: string | null
          created_at: string
          created_by: string
          crossing_date: string
          destination: string | null
          expires_at: string
          id: string
          marine_hostess: string | null
          mechanic: string | null
          port_of_origin: string | null
          status: string
          time_of_arrival: string | null
          time_of_departure: string | null
          total_guests: number | null
          updated_at: string
          vessel_id: string | null
          vessel_name_override: string | null
        }
        Insert: {
          ab_name?: string | null
          captain_on_board?: string | null
          created_at?: string
          created_by?: string
          crossing_date: string
          destination?: string | null
          expires_at?: string
          id?: string
          marine_hostess?: string | null
          mechanic?: string | null
          port_of_origin?: string | null
          status?: string
          time_of_arrival?: string | null
          time_of_departure?: string | null
          total_guests?: number | null
          updated_at?: string
          vessel_id?: string | null
          vessel_name_override?: string | null
        }
        Update: {
          ab_name?: string | null
          captain_on_board?: string | null
          created_at?: string
          created_by?: string
          crossing_date?: string
          destination?: string | null
          expires_at?: string
          id?: string
          marine_hostess?: string | null
          mechanic?: string | null
          port_of_origin?: string | null
          status?: string
          time_of_arrival?: string | null
          time_of_departure?: string | null
          total_guests?: number | null
          updated_at?: string
          vessel_id?: string | null
          vessel_name_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crossings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crossings_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "vessels"
            referencedColumns: ["id"]
          },
        ]
      }
      known_crew: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          name: string
          owner_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          name: string
          owner_id?: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          name?: string
          owner_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "known_crew_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      known_people: {
        Row: {
          company_id_number: string | null
          company_name: string | null
          created_at: string
          department: string | null
          id: string
          last_used_at: string
          name: string
          owner_id: string
        }
        Insert: {
          company_id_number?: string | null
          company_name?: string | null
          created_at?: string
          department?: string | null
          id?: string
          last_used_at?: string
          name: string
          owner_id?: string
        }
        Update: {
          company_id_number?: string | null
          company_name?: string | null
          created_at?: string
          department?: string | null
          id?: string
          last_used_at?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "known_people_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          classification_computed: string
          classification_final: string
          classification_overridden: boolean
          company_id_number: string | null
          company_name: string | null
          created_at: string
          crossing_id: string
          department: string | null
          id: string
          name: string
          seat_number: number
          updated_at: string
        }
        Insert: {
          classification_computed: string
          classification_final: string
          classification_overridden?: boolean
          company_id_number?: string | null
          company_name?: string | null
          created_at?: string
          crossing_id: string
          department?: string | null
          id?: string
          name: string
          seat_number: number
          updated_at?: string
        }
        Update: {
          classification_computed?: string
          classification_final?: string
          classification_overridden?: boolean
          company_id_number?: string | null
          company_name?: string | null
          created_at?: string
          crossing_id?: string
          department?: string | null
          id?: string
          name?: string
          seat_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passengers_crossing_id_fkey"
            columns: ["crossing_id"]
            isOneToOne: false
            referencedRelation: "crossings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      vessels: {
        Row: {
          created_at: string
          id: string
          name: string
          seat_layout_ref: string
          status: string
          total_seats: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          seat_layout_ref: string
          status?: string
          total_seats: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          seat_layout_ref?: string
          status?: string
          total_seats?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
