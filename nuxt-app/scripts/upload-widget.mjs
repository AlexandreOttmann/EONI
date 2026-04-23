import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY
const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY
const bucket = process.env.CLOUDFLARE_R2_BUCKET ?? 'ecommerce-ai-content'

if (!accountId || !accessKey || !secretKey) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY, or CLOUDFLARE_R2_SECRET_KEY')
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
})

const widgetPath = resolve(__dirname, '../public/widget.js')
const body = readFileSync(widgetPath)

const command = new PutObjectCommand({
  Bucket: bucket,
  Key: 'widget.js',
  Body: body,
  ContentType: 'application/javascript; charset=utf-8',
  CacheControl: 'public, max-age=3600',
})

await client.send(command)
console.log(`✓ widget.js uploaded to R2 bucket "${bucket}" (${body.length} bytes)`)
