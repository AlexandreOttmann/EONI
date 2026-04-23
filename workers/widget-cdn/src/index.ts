interface Env {
  WIDGET_BUCKET: R2Bucket
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      })
    }

    const object = await env.WIDGET_BUCKET.get('widget.js')
    if (!object) return new Response('Not Found', { status: 404 })

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    headers.set('Content-Type', 'application/javascript; charset=utf-8')

    return new Response(object.body, { headers })
  },
}
