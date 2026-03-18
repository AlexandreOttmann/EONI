import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { AnalyticsResponse } from '~/types/api'

export default defineEventHandler(async (event): Promise<AnalyticsResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const client = await serverSupabaseServiceRole(event)

  const [
    { count: totalConversations },
    { count: totalMessages },
    { data: topQuestionsData },
    { count: noAnswerCount },
    { count: totalAssistantMessages }
  ] = await Promise.all([
    client.from('conversations').select('*', { count: 'exact', head: true }).eq('merchant_id', user.sub),
    client.from('messages').select('*', { count: 'exact', head: true }).eq('merchant_id', user.sub),
    client.from('messages').select('content').eq('merchant_id', user.sub).eq('role', 'user').limit(1000),
    client.from('messages').select('*', { count: 'exact', head: true }).eq('merchant_id', user.sub).eq('role', 'assistant').or('confidence_score.is.null,confidence_score.lt.0.72'),
    client.from('messages').select('*', { count: 'exact', head: true }).eq('merchant_id', user.sub).eq('role', 'assistant')
  ])

  // Aggregate top questions client-side from fetched data
  const questionCounts = new Map<string, number>()
  for (const row of topQuestionsData ?? []) {
    questionCounts.set(row.content, (questionCounts.get(row.content) ?? 0) + 1)
  }
  const topQuestions = Array.from(questionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([content, count]) => ({ content, count }))

  const noAnswerRate = totalAssistantMessages
    ? (noAnswerCount ?? 0) / totalAssistantMessages
    : 0

  return {
    total_conversations: totalConversations ?? 0,
    total_messages: totalMessages ?? 0,
    top_questions: topQuestions,
    no_answer_rate: noAnswerRate
  }
})
