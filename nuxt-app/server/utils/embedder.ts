import OpenAI from 'openai'

const BATCH_SIZE = 2048

const clientCache = new Map<string, OpenAI>()
function getClient(apiKey: string): OpenAI {
  let c = clientCache.get(apiKey)
  if (!c) { c = new OpenAI({ apiKey }); clientCache.set(apiKey, c) }
  return c
}

export async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const client = getClient(apiKey)
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model: 'text-embedding-3-large',
      input: batch,
      dimensions: 1536
    }).catch((err: Error) => {
      throw createError({ statusCode: 502, message: `OpenAI embedding error: ${err.message}` })
    })
    results.push(...response.data.map(d => d.embedding))
  }

  return results
}
