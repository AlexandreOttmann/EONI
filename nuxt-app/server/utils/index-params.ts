import { z } from 'zod'

export const indexNameSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, {
  message: 'indexName must be 1-128 characters and contain only letters, numbers, hyphens, or underscores',
})

export const objectIdSchema = z.string().min(1).max(512)

export function validateIndexName(indexName: string | undefined): string {
  if (!indexName) throw createError({ statusCode: 400, message: 'Missing indexName' })
  const result = indexNameSchema.safeParse(indexName)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.issues[0]?.message ?? 'Invalid indexName' })
  return result.data
}

export function validateObjectId(objectId: string | undefined): string {
  if (!objectId) throw createError({ statusCode: 400, message: 'Missing objectId' })
  const result = objectIdSchema.safeParse(objectId)
  if (!result.success) throw createError({ statusCode: 400, message: result.error.issues[0]?.message ?? 'Invalid objectId' })
  return result.data
}

// Note: z.lazy() with z.record() is not supported in Zod v4 due to internal
// API changes. Use z.unknown() to accept any value and validate downstream.
export const recordValueSchema: z.ZodTypeAny = z.unknown()
