-- Migration: Add crawl configuration columns to crawl_jobs
-- Stores the user-selected patterns and limit for observability and resume

ALTER TABLE crawl_jobs ADD COLUMN page_limit integer DEFAULT 100;
ALTER TABLE crawl_jobs ADD COLUMN include_patterns text[] DEFAULT '{}';
ALTER TABLE crawl_jobs ADD COLUMN exclude_patterns text[] DEFAULT '{}';
