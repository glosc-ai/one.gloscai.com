/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { Analytics } from 'firebase/analytics'
import type { FirebaseApp, FirebaseOptions } from 'firebase/app'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

let analyticsPromise: Promise<Analytics | null> | null = null

function hasFirebaseAnalyticsConfig(config: FirebaseOptions): boolean {
  return Boolean(
    config.apiKey && config.projectId && config.appId && config.measurementId
  )
}

function getDefaultFirebaseApp(
  config: FirebaseOptions,
  firebaseApp: typeof import('firebase/app')
): FirebaseApp {
  try {
    return firebaseApp.getApp()
  } catch {
    return firebaseApp.initializeApp(config)
  }
}

export function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise

  analyticsPromise = (async () => {
    if (typeof window === 'undefined') return null
    if (!hasFirebaseAnalyticsConfig(firebaseConfig)) return null

    const [analyticsSdk, firebaseApp] = await Promise.all([
      import('firebase/analytics'),
      import('firebase/app'),
    ])
    if (!(await analyticsSdk.isSupported())) return null

    return analyticsSdk.getAnalytics(
      getDefaultFirebaseApp(firebaseConfig, firebaseApp)
    )
  })().catch(() => null)

  return analyticsPromise
}
