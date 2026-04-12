// This file is a stub — replace with the generated output from:
//   supabase gen types typescript --project-id <your-project-id>
// after the Supabase project is created.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string
          email: string
          name: string
          domain: string | null
          widget_config: Json
          subscription_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          domain?: string | null
          widget_config?: Json
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          domain?: string | null
          widget_config?: Json
          subscription_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          merchant_id: string
          name: string
          domain: string | null
          description: string | null
          logo_url: string | null
          extracted_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          name: string
          domain?: string | null
          description?: string | null
          logo_url?: string | null
          extracted_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          name?: string
          domain?: string | null
          description?: string | null
          logo_url?: string | null
          extracted_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brands_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      crawl_jobs: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          url: string
          status: string
          pages_found: number
          pages_crawled: number
          chunks_created: number
          products_extracted: number
          page_limit: number
          include_patterns: string[]
          exclude_patterns: string[]
          error: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          cf_job_id: string | null
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          url: string
          status?: string
          pages_found?: number
          pages_crawled?: number
          chunks_created?: number
          products_extracted?: number
          page_limit?: number
          include_patterns?: string[]
          exclude_patterns?: string[]
          error?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          cf_job_id?: string | null
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          url?: string
          status?: string
          pages_found?: number
          pages_crawled?: number
          chunks_created?: number
          products_extracted?: number
          page_limit?: number
          include_patterns?: string[]
          exclude_patterns?: string[]
          error?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          cf_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'crawl_jobs_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      pages: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          crawl_job_id: string
          url: string
          title: string | null
          markdown: string | null
          crawled_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          crawl_job_id: string
          url: string
          title?: string | null
          markdown?: string | null
          crawled_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          crawl_job_id?: string
          url?: string
          title?: string | null
          markdown?: string | null
          crawled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pages_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_crawl_job_id_fkey'
            columns: ['crawl_job_id']
            referencedRelation: 'crawl_jobs'
            referencedColumns: ['id']
          }
        ]
      }
      chunks: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          page_id: string
          content: string
          content_type: string
          embedding: string | null
          metadata: Json
          token_count: number
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          page_id: string
          content: string
          content_type?: string
          embedding?: string | null
          metadata?: Json
          token_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          page_id?: string
          content?: string
          content_type?: string
          embedding?: string | null
          metadata?: Json
          token_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chunks_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chunks_page_id_fkey'
            columns: ['page_id']
            referencedRelation: 'pages'
            referencedColumns: ['id']
          }
        ]
      }
      products: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          page_id: string | null
          crawl_job_id: string
          name: string
          description: string | null
          price: number | null
          currency: string
          availability: string
          sku: string | null
          category: string | null
          image_url: string | null
          source_url: string
          extra_data: Json
          extraction_confidence: string
          missing_fields: string[]
          embedding: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          page_id?: string | null
          crawl_job_id: string
          name: string
          description?: string | null
          price?: number | null
          currency?: string
          availability?: string
          sku?: string | null
          category?: string | null
          image_url?: string | null
          source_url: string
          extra_data?: Json
          extraction_confidence?: string
          missing_fields?: string[]
          embedding?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          page_id?: string | null
          crawl_job_id?: string
          name?: string
          description?: string | null
          price?: number | null
          currency?: string
          availability?: string
          sku?: string | null
          category?: string | null
          image_url?: string | null
          source_url?: string
          extra_data?: Json
          extraction_confidence?: string
          missing_fields?: string[]
          embedding?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_page_id_fkey'
            columns: ['page_id']
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_crawl_job_id_fkey'
            columns: ['crawl_job_id']
            referencedRelation: 'crawl_jobs'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          session_id: string
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          session_id: string
          source?: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          session_id?: string
          source?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          merchant_id: string
          role: string
          content: string
          chunks_used: string[]
          confidence_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          merchant_id: string
          role: string
          content: string
          chunks_used?: string[]
          confidence_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          merchant_id?: string
          role?: string
          content?: string
          chunks_used?: string[]
          confidence_score?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      indexes: {
        Row: {
          id: string
          merchant_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'indexes_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      records: {
        Row: {
          id: string
          merchant_id: string
          brand_id: string | null
          index_name: string
          object_id: string
          fields: Json
          searchable_text: string
          embedding: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          brand_id?: string | null
          index_name: string
          object_id: string
          fields?: Json
          searchable_text?: string
          embedding?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          brand_id?: string | null
          index_name?: string
          object_id?: string
          fields?: Json
          searchable_text?: string
          embedding?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'records_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
      record_edges: {
        Row: {
          id: string
          merchant_id: string
          source_record_id: string
          target_record_id: string
          edge_type: string
          edge_value: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          source_record_id: string
          target_record_id: string
          edge_type: string
          edge_value: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          source_record_id?: string
          target_record_id?: string
          edge_type?: string
          edge_value?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'record_edges_source_record_id_fkey'
            columns: ['source_record_id']
            referencedRelation: 'records'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'record_edges_target_record_id_fkey'
            columns: ['target_record_id']
            referencedRelation: 'records'
            referencedColumns: ['id']
          }
        ]
      }
      webhook_configs: {
        Row: {
          id: string
          merchant_id: string
          event_type: string
          url: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          event_type: string
          url: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          event_type?: string
          url?: string
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'webhook_configs_merchant_id_fkey'
            columns: ['merchant_id']
            referencedRelation: 'merchants'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_merchant_id: string
        }
        Returns: Array<{
          id: string
          content: string
          metadata: Json
          similarity: number
        }>
      }
      match_products: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_merchant_id: string
          p_brand_id?: string | null
        }
        Returns: Array<{
          id: string
          name: string
          description: string | null
          price: number | null
          currency: string
          availability: string
          category: string | null
          source_url: string
          image_url: string | null
          similarity: number
        }>
      }
      match_records: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_merchant_id: string
          p_index_name?: string | null
          p_brand_id?: string | null
        }
        Returns: Array<{
          id: string
          object_id: string
          index_name: string
          fields: Json
          searchable_text: string
          similarity: number
        }>
      }
      match_chunks_by_type: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          p_merchant_id: string
          p_brand_id?: string | null
          p_content_types?: string[]
        }
        Returns: Array<{
          id: string
          content: string
          metadata: Json
          similarity: number
        }>
      }
    }
    Enums: Record<string, never>
  }
}
