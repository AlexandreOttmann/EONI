import OpenAI from 'openai'

const BATCH_SIZE = 2048

export async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const client = new OpenAI({ apiKey })
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch
    }).catch((err: Error) => {
      throw createError({ statusCode: 502, message: `OpenAI embedding error: ${err.message}` })
    })
    results.push(...response.data.map(d => d.embedding))
  }

  return results
}
