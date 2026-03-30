import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync } from 'node:fs'

type ServiceAccountShape = {
  project_id?: string
  client_email?: string
  private_key?: string
}

function readServiceAccountFromEnv(): ServiceAccountShape | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (rawJson) {
    try {
      return JSON.parse(rawJson) as ServiceAccountShape
    } catch {
      console.warn('[firebase-admin] Invalid FIREBASE_SERVICE_ACCOUNT_JSON; falling back to split env vars')
    }
  }

  const project_id = process.env.FIREBASE_PROJECT_ID?.trim()
  const client_email = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!project_id || !client_email || !private_key) return null
  return { project_id, client_email, private_key }
}

export function hasFirebaseAdminConfig(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return true
  if (
    process.env.FIREBASE_PROJECT_ID?.trim() &&
    process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
    process.env.FIREBASE_PRIVATE_KEY?.trim()
  ) return true

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (credentialsPath && existsSync(credentialsPath)) return true

  return false
}

function ensureFirebaseApp(): void {
  if (getApps().length > 0) return

  const serviceAccount = readServiceAccountFromEnv()
  if (serviceAccount?.project_id && serviceAccount.client_email && serviceAccount.private_key) {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    })
    return
  }

  initializeApp({ credential: applicationDefault() })
}

export function getAdminDb() {
  ensureFirebaseApp()
  return getFirestore()
}

