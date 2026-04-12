#!/usr/bin/env node
// Push 5 travel records to the "test-1" index via the local dev API.
// Usage:
//   Email/password:  node scripts/push-travel-records.mjs --email me@x.com --password secret
//   OAuth token:     node scripts/push-travel-records.mjs --token <access_token>
//
// To get your token after OAuth login, run this in the browser console at localhost:3000:
//   JSON.parse(localStorage.getItem('sb-bawjcpdirytrbzrplape-auth-token')).access_token

import { createClient } from '../nuxt-app/node_modules/@supabase/supabase-js/dist/index.mjs'

const SUPABASE_URL = 'https://bawjcpdirytrbzrplape.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_2cRFmPuWSeYunqj-kaf3dA_B_3rA-7I'
const BASE_URL = 'http://localhost:3000'
const INDEX_NAME = 'test-1'

const args = process.argv.slice(2)
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null }

const tokenArg = get('--token')
const email    = get('--email')
const password = get('--password')

if (!tokenArg && !(email && password)) {
  console.error('Usage:')
  console.error('  OAuth:          node scripts/push-travel-records.mjs --token <access_token>')
  console.error('  Email/password: node scripts/push-travel-records.mjs --email <email> --password <password>')
  console.error()
  console.error('Get your OAuth token from the browser console (localhost:3000):')
  console.error("  JSON.parse(localStorage.getItem('sb-bawjcpdirytrbzrplape-auth-token')).access_token")
  process.exit(1)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

let token = tokenArg

if (!token) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError || !authData.session) {
    console.error('Auth failed:', authError?.message ?? 'no session')
    process.exit(1)
  }
  token = authData.session.access_token
  console.log('Signed in as', email)
} else {
  console.log('Using provided access token')
}

// ─── Records ─────────────────────────────────────────────────────────────────

const records = [
  {
    objectID: 'travel-kyoto-001',
    destination: 'Kyoto, Japan',
    duration_days: 7,
    price_usd: 2400,
    category: 'Cultural',
    highlights: 'Fushimi Inari shrine, bamboo groves, traditional tea ceremony',
    best_season: 'Spring (March–May)',
    difficulty: 'Easy',
    available: true,
  },
  {
    objectID: 'travel-patagonia-002',
    destination: 'Patagonia, Argentina & Chile',
    duration_days: 14,
    price_usd: 4800,
    category: 'Adventure',
    highlights: 'Torres del Paine, Perito Moreno glacier, trekking W Circuit',
    best_season: 'Summer (Dec–Feb)',
    difficulty: 'Challenging',
    available: true,
  },
  {
    objectID: 'travel-amalfi-003',
    destination: 'Amalfi Coast, Italy',
    duration_days: 10,
    price_usd: 3600,
    category: 'Leisure',
    highlights: 'Positano cliffside villages, limoncello tasting, boat tours',
    best_season: 'Summer (Jun–Aug)',
    difficulty: 'Easy',
    available: true,
  },
  {
    objectID: 'travel-marrakech-004',
    destination: 'Marrakech, Morocco',
    duration_days: 6,
    price_usd: 1800,
    category: 'Cultural',
    highlights: 'Medina souks, Jardin Majorelle, Sahara desert day trip',
    best_season: 'Autumn (Sep–Nov)',
    difficulty: 'Moderate',
    available: false,
  },
  {
    objectID: 'travel-iceland-005',
    destination: 'Iceland Ring Road',
    duration_days: 12,
    price_usd: 5200,
    category: 'Adventure',
    highlights: 'Northern lights, geysers, black sand beaches, whale watching',
    best_season: 'Winter (Nov–Feb)',
    difficulty: 'Moderate',
    available: true,
  },
]

// ─── Push ─────────────────────────────────────────────────────────────────────

console.log(`\nPushing ${records.length} records to index "${INDEX_NAME}"…`)

const res = await fetch(`${BASE_URL}/api/indexes/${INDEX_NAME}/records/batch`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(records),
})

const body = await res.json()

if (!res.ok) {
  console.error('Error:', res.status, body)
  process.exit(1)
}

console.log('Done!')
console.log(`  taskID:      ${body.taskID}`)
console.log(`  indexName:   ${body.indexName}`)
console.log(`  objectsCount: ${body.objectsCount}`)
console.log(`  status:      ${body.status}`)
