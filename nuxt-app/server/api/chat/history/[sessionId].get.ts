import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import type { ChatHistoryResponse, Conversation, Message } from '~/types/api'

export default defineEventHandler(async (event): Promise<ChatHistoryResponse> => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const sessionId = z.string().min(1).parse(getRouterParam(event, 'sessionId'))
  const client = await serverSupabaseServiceRole(event)

  const { data: conversation } = await client
    .from('conversations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('merchant_id', user.id)
    .single()

  if (!conversation) throw createError({ statusCode: 404, message: 'Conversation not found' })

  const { data: messages, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .eq('merchant_id', user.id)
    .order('created_at', { ascending: true })

  if (error) throw createError({ statusCode: 500, message: 'Failed to fetch messages' })

  return {
    conversation: conversation as unknown as Conversation,
    messages: (messages ?? []) as unknown as Message[]
  }
})
