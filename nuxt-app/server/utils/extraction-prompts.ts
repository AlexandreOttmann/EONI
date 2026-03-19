/**
 * Prompt and JSON schema used to extract structured product/service data
 * from crawled pages at crawl time. Passed to Cloudflare's browser-rendering
 * API as `jsonOptions` so structured data arrives alongside markdown.
 */

export const EXTRACTION_PROMPT = `Extract product or service information from this page.
For each item found, extract: name, description, price (number without currency symbol),
currency (ISO 4217: USD, EUR, GBP), availability (in_stock, out_of_stock, preorder),
SKU or product code if present, category or type, and primary image URL.
If this page does not contain product or service listings, return an empty items array.
Focus on the main content — ignore navigation, footer, sidebar, cookie banners.`

export const EXTRACTION_SCHEMA = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'page_extraction',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
            availability: { type: 'string' },
            sku: { type: 'string' },
            category: { type: 'string' },
            image_url: { type: 'string' }
          }
        }
      }
    }
  }
}
