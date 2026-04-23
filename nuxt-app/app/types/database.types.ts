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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string | null
          description: string | null
          domain: string | null
          domains: string[]
          extracted_description: string | null
          id: string
          logo_url: string | null
          merchant_id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[]
          extracted_description?: string | null
          id?: string
          logo_url?: string | null
          merchant_id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[]
          extracted_description?: string | null
          id?: string
          logo_url?: string | null
          merchant_id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          brand_id: string | null
          content: string
          content_type: string
          created_at: string
          embedding: string | null
          embedding_model: string
          id: string
          merchant_id: string
          metadata: Json
          page_id: string
          token_count: number
        }
        Insert: {
          brand_id?: string | null
          content: string
          content_type?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string
          id?: string
          merchant_id: string
          metadata?: Json
          page_id: string
          token_count?: number
        }
        Update: {
          brand_id?: string | null
          content?: string
          content_type?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string
          id?: string
          merchant_id?: string
          metadata?: Json
          page_id?: string
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chunks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          merchant_id: string
          session_id: string
          source: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          session_id: string
          source?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_jobs: {
        Row: {
          brand_id: string | null
          cf_job_id: string | null
          chunks_created: number
          completed_at: string | null
          created_at: string
          error: string | null
          exclude_patterns: string[] | null
          id: string
          include_patterns: string[] | null
          merchant_id: string
          page_limit: number | null
          pages_crawled: number
          pages_found: number
          products_extracted: number | null
          started_at: string | null
          status: string
          url: string
        }
        Insert: {
          brand_id?: string | null
          cf_job_id?: string | null
          chunks_created?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          exclude_patterns?: string[] | null
          id?: string
          include_patterns?: string[] | null
          merchant_id: string
          page_limit?: number | null
          pages_crawled?: number
          pages_found?: number
          products_extracted?: number | null
          started_at?: string | null
          status?: string
          url: string
        }
        Update: {
          brand_id?: string | null
          cf_job_id?: string | null
          chunks_created?: number
          completed_at?: string | null
          created_at?: string
          error?: string | null
          exclude_patterns?: string[] | null
          id?: string
          include_patterns?: string[] | null
          merchant_id?: string
          page_limit?: number | null
          pages_crawled?: number
          pages_found?: number
          products_extracted?: number | null
          started_at?: string | null
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_jobs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      indexes: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          merchant_id: string
          name: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          merchant_id: string
          name: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          merchant_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "indexes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indexes_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          domain: string | null
          email: string
          id: string
          name: string
          subscription_status: string
          updated_at: string
          widget_config: Json
        }
        Insert: {
          created_at?: string
          domain?: string | null
          email: string
          id: string
          name: string
          subscription_status?: string
          updated_at?: string
          widget_config?: Json
        }
        Update: {
          created_at?: string
          domain?: string | null
          email?: string
          id?: string
          name?: string
          subscription_status?: string
          updated_at?: string
          widget_config?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          chunks_used: string[]
          confidence_score: number | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          merchant_id: string
          role: string
        }
        Insert: {
          chunks_used?: string[]
          confidence_score?: number | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          merchant_id: string
          role: string
        }
        Update: {
          chunks_used?: string[]
          confidence_score?: number | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          merchant_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          brand_id: string | null
          crawl_job_id: string
          crawled_at: string
          id: string
          markdown: string | null
          merchant_id: string
          title: string | null
          url: string
        }
        Insert: {
          brand_id?: string | null
          crawl_job_id: string
          crawled_at?: string
          id?: string
          markdown?: string | null
          merchant_id: string
          title?: string | null
          url: string
        }
        Update: {
          brand_id?: string | null
          crawl_job_id?: string
          crawled_at?: string
          id?: string
          markdown?: string | null
          merchant_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_crawl_job_id_fkey"
            columns: ["crawl_job_id"]
            isOneToOne: false
            referencedRelation: "crawl_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      query_cache: {
        Row: {
          cache_key: string
          context_json: Json
          created_at: string
          expires_at: string
          id: string
          merchant_id: string
        }
        Insert: {
          cache_key: string
          context_json: Json
          created_at?: string
          expires_at?: string
          id?: string
          merchant_id: string
        }
        Update: {
          cache_key?: string
          context_json?: Json
          created_at?: string
          expires_at?: string
          id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_cache_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      record_edges: {
        Row: {
          created_at: string
          edge_type: string
          edge_value: string
          id: string
          merchant_id: string
          source_record_id: string
          target_record_id: string
        }
        Insert: {
          created_at?: string
          edge_type: string
          edge_value: string
          id?: string
          merchant_id: string
          source_record_id: string
          target_record_id: string
        }
        Update: {
          created_at?: string
          edge_type?: string
          edge_value?: string
          id?: string
          merchant_id?: string
          source_record_id?: string
          target_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_edges_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_edges_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_edges_target_record_id_fkey"
            columns: ["target_record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          brand_id: string | null
          created_at: string
          embedding: string | null
          embedding_model: string
          fields: Json
          id: string
          index_name: string
          merchant_id: string
          object_id: string
          searchable_text: string
          searchable_tsv: unknown
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          embedding?: string | null
          embedding_model?: string
          fields?: Json
          id?: string
          index_name: string
          merchant_id: string
          object_id: string
          searchable_text?: string
          searchable_tsv?: unknown
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          embedding?: string | null
          embedding_model?: string
          fields?: Json
          id?: string
          index_name?: string
          merchant_id?: string
          object_id?: string
          searchable_text?: string
          searchable_tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          active: boolean
          created_at: string
          event_type: string
          id: string
          merchant_id: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_type: string
          id?: string
          merchant_id: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event_type?: string
          id?: string
          merchant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_rate_limit: {
        Args: { p_key: string; p_max_requests: number; p_window_ms: number }
        Returns: {
          allowed: boolean
        }[]
      }
      list_records_for_aggregation: {
        Args: {
          p_brand_id?: string
          p_index_name?: string
          p_limit?: number
          p_merchant_id: string
        }
        Returns: {
          fields: Json
          object_id: string
          searchable_text: string
        }[]
      }
      match_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          p_merchant_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_chunks_by_type: {
        Args: {
          match_count: number
          match_threshold: number
          p_brand_id?: string
          p_content_types?: string[]
          p_merchant_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_records: {
        Args: {
          match_count: number
          match_threshold: number
          p_brand_id?: string
          p_index_name?: string
          p_merchant_id: string
          query_embedding: string
        }
        Returns: {
          fields: Json
          id: string
          index_name: string
          object_id: string
          similarity: number
        }[]
      }
      match_records_hybrid: {
        Args: {
          match_count: number
          p_brand_id?: string
          p_index_name?: string
          p_merchant_id: string
          query_embedding: string
          query_text: string
        }
        Returns: {
          fields: Json
          id: string
          index_name: string
          object_id: string
          rrf_score: number
          similarity: number
        }[]
      }
      reassign_crawl_brand: {
        Args: {
          p_crawl_job_id: string
          p_merchant_id: string
          p_target_brand_id: string
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
    Enums: {},
  },
} as const
