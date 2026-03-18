import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { CrawlJob, CrawlJobsResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<CrawlJobsResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('crawl_jobs')
    .select('*')
    .eq('merchant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch crawl jobs' })
  return { jobs: (data ?? []) as unknown as CrawlJob[] }
})
