export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      action_notes: {
        Row: {
          action_id: string
          autor_id: string | null
          fecha: string
          id: string
          texto: string
        }
        Insert: {
          action_id: string
          autor_id?: string | null
          fecha?: string
          id?: string
          texto: string
        }
        Update: {
          action_id?: string
          autor_id?: string | null
          fecha?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_notes_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_notes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      actions: {
        Row: {
          code: string
          created_at: string
          descripcion: string | null
          estado: string | null
          id: string
          inversion: boolean
          owner_id: string | null
          prioridad: string | null
          project_id: string
          titulo: string
          vence: string | null
        }
        Insert: {
          code: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          id?: string
          inversion?: boolean
          owner_id?: string | null
          prioridad?: string | null
          project_id: string
          titulo: string
          vence?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          id?: string
          inversion?: boolean
          owner_id?: string | null
          prioridad?: string | null
          project_id?: string
          titulo?: string
          vence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cases: {
        Row: {
          ahorro_bruto_anual: number | null
          capex: number | null
          code: string
          created_at: string
          fecha_limite: string | null
          id: string
          inicio: string | null
          opex_anual: number | null
          project_id: string | null
          tasa: number | null
          titulo: string | null
        }
        Insert: {
          ahorro_bruto_anual?: number | null
          capex?: number | null
          code: string
          created_at?: string
          fecha_limite?: string | null
          id?: string
          inicio?: string | null
          opex_anual?: number | null
          project_id?: string | null
          tasa?: number | null
          titulo?: string | null
        }
        Update: {
          ahorro_bruto_anual?: number | null
          capex?: number | null
          code?: string
          created_at?: string
          fecha_limite?: string | null
          id?: string
          inicio?: string | null
          opex_anual?: number | null
          project_id?: string | null
          tasa?: number | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          estado: string
          id: string
          iniciales: string | null
          nombre: string
          sector: string | null
        }
        Insert: {
          created_at?: string
          estado?: string
          id?: string
          iniciales?: string | null
          nombre: string
          sector?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          id?: string
          iniciales?: string | null
          nombre?: string
          sector?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          business_case_id: string
          concepto: string | null
          created_at: string
          fecha: string
          id: string
          monto: number
          tipo: string | null
        }
        Insert: {
          business_case_id: string
          concepto?: string | null
          created_at?: string
          fecha: string
          id?: string
          monto: number
          tipo?: string | null
        }
        Update: {
          business_case_id?: string
          concepto?: string | null
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_case_id_fkey"
            columns: ["business_case_id"]
            isOneToOne: false
            referencedRelation: "business_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      kpis: {
        Row: {
          base: number | null
          created_at: string
          descripcion: string | null
          id: string
          mejor_baja: boolean
          meta: number | null
          nombre: string
          project_id: string
          unidad: string | null
        }
        Insert: {
          base?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          mejor_baja?: boolean
          meta?: number | null
          nombre: string
          project_id: string
          unidad?: string | null
        }
        Update: {
          base?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          mejor_baja?: boolean
          meta?: number | null
          nombre?: string
          project_id?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          ahorro: number | null
          created_at: string
          fecha: string
          id: string
          kpi_id: string
          valor: number
        }
        Insert: {
          ahorro?: number | null
          created_at?: string
          fecha: string
          id?: string
          kpi_id: string
          valor: number
        }
        Update: {
          ahorro?: number | null
          created_at?: string
          fecha?: string
          id?: string
          kpi_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "measurements_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          iniciales: string | null
          nombre: string
          rol: string
        }
        Insert: {
          created_at?: string
          id: string
          iniciales?: string | null
          nombre: string
          rol?: string
        }
        Update: {
          created_at?: string
          id?: string
          iniciales?: string | null
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          a3_content: Json
          ahorro_anual: number | null
          avance_pasos: number
          client_id: string | null
          code: string
          consultor_id: string | null
          created_at: string
          estado: string | null
          fase: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          lider_id: string | null
          miembros: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          a3_content?: Json
          ahorro_anual?: number | null
          avance_pasos?: number
          client_id?: string | null
          code: string
          consultor_id?: string | null
          created_at?: string
          estado?: string | null
          fase?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          lider_id?: string | null
          miembros?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          a3_content?: Json
          ahorro_anual?: number | null
          avance_pasos?: number
          client_id?: string | null
          code?: string
          consultor_id?: string | null
          created_at?: string
          estado?: string | null
          fase?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          lider_id?: string | null
          miembros?: string[]
          titulo?: string
          updated_at?: string
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
            foreignKeyName: "projects_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

