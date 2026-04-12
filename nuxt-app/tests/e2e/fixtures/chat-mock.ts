import { type Page } from '@playwright/test'

/**
 * Intercept POST /api/chat/stream and replay a deterministic mock SSE stream.
 *
 * The response always echoes back the provided `responseText` split across two
 * chunk events so streaming behaviour is exercised without calling a real LLM.
 */
export async function mockChatStream(page: Page, responseText: string): Promise<void> {
  const half = Math.floor(responseText.length / 2)
  const part1 = responseText.slice(0, half)
  const part2 = responseText.slice(half)

  await page.route('**/api/chat/stream', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
      body: [
        `event: sources\ndata: {"chunks":[],"products":[]}\n\n`,
        `event: chunk\ndata: ${JSON.stringify({ text: part1 })}\n\n`,
        `event: chunk\ndata: ${JSON.stringify({ text: part2 })}\n\n`,
        `event: done\ndata: {"message_id":"mock-message-id"}\n\n`,
      ].join(''),
    })
  })
}
