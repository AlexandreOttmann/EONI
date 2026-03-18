import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { CrawlJob, CrawlStatusResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<CrawlStatusResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const jobId = z.string().uuid().parse(getRouterParam(event, 'jobId'))

  const client = await serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('crawl_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('merchant_id', user.sub)
    .single()

  if (error || !data) throw createError({ statusCode: 404, message: 'Crawl job not found' })
  return { job: data as unknown as CrawlJob }
})
