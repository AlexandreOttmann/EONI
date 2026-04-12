import { consola } from 'consola'

// ─── R5: Jina AI Reranker ────────────────────────────────────

interface JinaRankedItem {
  index: number
  relevance_score: number
}

interface JinaRerankerResponse {
  results: JinaRankedItem[]
}

/**
 * Rerank documents against the query using Jina AI.
 *
 * Returns the original document indexes in ranked order (most relevant first).
 * If JINA_API_KEY is not set, documents.length === 0, or the API call fails,
 * returns the original order as a passthrough — never throws.
 *
 * @param query     The user query string
 * @param documents Flat array of document content strings to rerank
 * @param topN      Number of top results to return (default: 5)
 */
export async function rerankResults(
  query: string,
  documents: string[],
  topN: number = 5
): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY
  if (!apiKey || documents.length === 0) {
    return documents.map((_, i) => i)
  }

  try {
    const response = await $fetch<JinaRerankerResponse>(
      'https://api.jina.ai/v1/rerank',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: 'jina-reranker-v2-base-multilingual',
          query,
          documents,
          top_n: topN,
        },
        timeout: 3000, // 3 s — don't block chat if reranker is slow
      }
    )

    const ranked = response.results.map(r => r.index)
    consola.debug({ tag: 'reranker', query: query.slice(0, 60), topN, ranked })
    return ranked
  } catch (err) {
    consola.debug({ tag: 'reranker', message: 'Reranker fallback to original order', error: String(err) })
    return documents.map((_, i) => i) // graceful fallback — never block chat
  }
}
