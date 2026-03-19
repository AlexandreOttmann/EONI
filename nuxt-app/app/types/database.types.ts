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
      crawl_jobs: {
        Row: {
          id: string
          merchant_id: string
          url: string
          status: string
          pages_found: number
          pages_crawled: number
          chunks_created: number
          error: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          cf_job_id: string | null
        }
        Insert: {
          id?: string
          merchant_id: string
          url: string
          status?: string
          pages_found?: number
          pages_crawled?: number
          chunks_created?: number
          error?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          cf_job_id?: string | null
        }
        Update: {
          id?: string
          merchant_id?: string
          url?: string
          status?: string
          pages_found?: number
          pages_crawled?: number
          chunks_created?: number
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
          crawl_job_id: string
          url: string
          title: string | null
          markdown: string | null
          crawled_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          crawl_job_id: string
          url: string
          title?: string | null
          markdown?: string | null
          crawled_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
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
          page_id: string
          content: string
          embedding: string | null
          metadata: Json
          token_count: number
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          page_id: string
          content: string
          embedding?: string | null
          metadata?: Json
          token_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          page_id?: string
          content?: string
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
      conversations: {
        Row: {
          id: string
          merchant_id: string
          session_id: string
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          session_id: string
          source?: string
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
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
    }
    Enums: Record<string, never>
  }
}
