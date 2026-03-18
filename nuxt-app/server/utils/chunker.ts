import type { ChunkMetadata } from '~/types/api'

export interface RawChunk {
  content: string
  tokenCount: number
  metadata: ChunkMetadata
}

const TARGET_TOKENS = 500
const WORDS_PER_TOKEN = 1.3

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length / WORDS_PER_TOKEN)
}

function extractMetadata(text: string, sourceUrl: string): ChunkMetadata {
  const prices = text.match(/(?:€|\$|£|EUR|USD)\s*[\d,]+(?:\.\d{2})?/g)
  const dates = text.match(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi)
  return {
    source_url: sourceUrl,
    ...(prices?.length ? { price: parseFloat(prices[0].replace(/[^0-9.]/g, '')) } : {}),
    ...(dates?.length ? { dates } : {})
  }
}

function splitToFit(text: string, delimiter: string): string[] {
  return text.split(delimiter).filter(s => s.trim().length > 0)
}

export function chunkMarkdown(
  markdown: string,
  sourceUrl: string,
  title: string,
  merchantName: string
): RawChunk[] {
  const prefix = `[Source: ${merchantName} | ${sourceUrl}]\n${title}\n\n`
  const chunks: RawChunk[] = []

  // Split by H2 sections first
  const sections = markdown.split(/(?=^## )/m).filter(s => s.trim().length > 0)

  for (const section of sections) {
    if (estimateTokens(section) <= TARGET_TOKENS) {
      const content = prefix + section.trim()
      chunks.push({ content, tokenCount: estimateTokens(content), metadata: extractMetadata(section, sourceUrl) })
      continue
    }
    // Split by paragraphs
    for (const para of splitToFit(section, '\n\n')) {
      if (estimateTokens(para) <= TARGET_TOKENS) {
        const content = prefix + para.trim()
        chunks.push({ content, tokenCount: estimateTokens(content), metadata: extractMetadata(para, sourceUrl) })
        continue
      }
      // Split by sentences
      for (const sentence of splitToFit(para, '. ')) {
        const content = prefix + sentence.trim()
        chunks.push({ content, tokenCount: estimateTokens(content), metadata: extractMetadata(sentence, sourceUrl) })
      }
    }
  }

  return chunks.filter(c => c.tokenCount > 0)
}
