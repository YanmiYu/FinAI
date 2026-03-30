import dotenv from 'dotenv'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdminDb } from '../services/firebaseAdmin.js'

dotenv.config()

type SeedDoc = {
  id: string
  term_en: string
  term_zh: string
  definition_en: string
  definition_zh: string
  category: string
  keywords: string[]
  example: { en: string; zh: string }
  related_terms: string[]
}

async function seed(): Promise<void> {
  const db = getAdminDb()
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const filePath = path.resolve(currentDir, '../data/financial_knowledge_base.json')
  const raw = await readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { financial_knowledge_base?: SeedDoc[] }
  const docs = parsed.financial_knowledge_base ?? []
  if (docs.length === 0) {
    console.log('[seed] No documents found in payload.')
    return
  }

  const batch = db.batch()
  for (const doc of docs) {
    if (!doc.id) continue
    const ref = db.collection('financial_knowledge_base').doc(doc.id)
    batch.set(ref, doc, { merge: true })
  }
  await batch.commit()

  console.log(`[seed] Upserted ${docs.length} docs into financial_knowledge_base.`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Failed:', err)
    process.exit(1)
  })

