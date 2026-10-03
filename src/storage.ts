import type { WorkoutSession } from './types'
import { updateExerciseProfilesFromSession } from './exerciseProgress'
import type { ExerciseProfiles } from './exerciseProgress'

const ACTIVE_KEY = 'fitprogress.active-session.v1'
const HISTORY_KEY = 'fitprogress.history.v1'
const ANALYTICS_HISTORY_KEY = 'fitprogress.analytics-history.v1'
const EXERCISE_PROFILES_KEY = 'fitprogress.exercise-profiles.v1'

const DB_NAME = 'fitprogress-db-v1'
const DB_VERSION = 1
const SESSION_STORE = 'sessions'
const STATE_STORE = 'state'
const ACTIVE_STATE_KEY = 'active-session'
const LOCAL_HISTORY_MIRROR_LIMIT = 20

let dbPromise: Promise<IDBDatabase | null> | null = null
let indexedDbReady = false
let memoryHistory: WorkoutSession[] | null = null
let memoryActive: WorkoutSession | null | undefined
let memoryProfiles: ExerciseProfiles | null = null
let activeWriteChain: Promise<boolean> = Promise.resolve(true)

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const safeJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const sessionTime = (session: WorkoutSession) => {
  const updated = new Date(session.updatedAt || session.finishedAt || session.startedAt).getTime()
  return Number.isFinite(updated) ? updated : 0
}

const newestSession = (a: WorkoutSession | undefined, b: WorkoutSession | undefined) => {
  if (!a) return b
  if (!b) return a
  return sessionTime(b) >= sessionTime(a) ? b : a
}

const sortHistory = (history: WorkoutSession[]) =>
  [...history].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' })
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

async function readIndexedSessions(db: IDBDatabase): Promise<WorkoutSession[]> {
  const tx = db.transaction(SESSION_STORE, 'readonly')
  const rows = await requestResult(tx.objectStore(SESSION_STORE).getAll())
  await transactionDone(tx)
  return (rows as WorkoutSession[]).filter((session) => Boolean(session?.sessionId))
}

async function writeIndexedSessions(db: IDBDatabase, sessions: WorkoutSession[]) {
  if (!sessions.length) return
  const tx = db.transaction(SESSION_STORE, 'readwrite')
  const store = tx.objectStore(SESSION_STORE)
  for (const session of sessions) store.put(clone(session))
  await transactionDone(tx)
}

async function putIndexedSession(session: WorkoutSession) {
  const db = await openDatabase()
  if (!db) return false
  try {
    const tx = db.transaction(SESSION_STORE, 'readwrite')
    tx.objectStore(SESSION_STORE).put(clone(session))
    await transactionDone(tx)
    return true
  } catch {
    return false
  }
}

interface ActiveStateRecord {
  key: string
  value: WorkoutSession | null
  updatedAt: string
}

async function readIndexedActive(db: IDBDatabase): Promise<ActiveStateRecord | null> {
  const tx = db.transaction(STATE_STORE, 'readonly')
  const row = await requestResult(tx.objectStore(STATE_STORE).get(ACTIVE_STATE_KEY)) as ActiveStateRecord | undefined
  await transactionDone(tx)
  return row ? clone(row) : null
}

async function writeIndexedActive(session: WorkoutSession | null) {
  const db = await openDatabase()
  if (!db) return false

  try {
    const tx = db.transaction(STATE_STORE, 'readwrite')
    tx.objectStore(STATE_STORE).put({
      key: ACTIVE_STATE_KEY,
      value: session ? clone(session) : null,
      updatedAt: session?.updatedAt ?? new Date().toISOString()
    } satisfies ActiveStateRecord)
    await transactionDone(tx)
    return true
  } catch {
    return false
  }
}

function queueIndexedActiveWrite(session: WorkoutSession | null) {
  activeWriteChain = activeWriteChain
    .catch(() => false)
    .then(() => writeIndexedActive(session))
  return activeWriteChain
}

function readLocalHistory() {
  try {
    return safeJson<WorkoutSession[]>(localStorage.getItem(HISTORY_KEY), [])
  } catch {
    return []
  }
}

function readLegacyAnalyticsHistory() {
  try {
    return safeJson<WorkoutSession[]>(localStorage.getItem(ANALYTICS_HISTORY_KEY), [])
  } catch {
    return []
  }
}

function readLocalActive() {
  try {
    return safeJson<WorkoutSession | null>(localStorage.getItem(ACTIVE_KEY), null)
  } catch {
    return null
  }
}

function writeLocalHistoryMirror(history: WorkoutSession[], fullFallback = false) {
  try {
    const rows = fullFallback ? history : history.slice(0, LOCAL_HISTORY_MIRROR_LIMIT)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(rows))
    return true
  } catch {
    return false
  }
}

function rebuildProfiles(history: WorkoutSession[]) {
  let profiles: ExerciseProfiles = {}
  const chronological = [...history]
    .filter((session) => Boolean(session.finishedAt))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  for (const session of chronological) {
    profiles = updateExerciseProfilesFromSession(profiles, session)
  }
  memoryProfiles = profiles

  // Old versions stored profiles in localStorage. The complete profile history is
  // now derived from IndexedDB sessions, so keeping another ever-growing copy
  // would defeat the purpose of the migration.
  try {
    localStorage.removeItem(EXERCISE_PROFILES_KEY)
  } catch {
    // Ignore restricted storage contexts.
  }
}

export async function initializeStorage() {
  const localHistory = readLocalHistory()
  const legacyAnalytics = readLegacyAnalyticsHistory()
  const localActive = readLocalActive()

  const db = await openDatabase()
  if (!db) {
    indexedDbReady = false
    const merged = new Map<string, WorkoutSession>()
    for (const session of [...legacyAnalytics, ...localHistory]) {
      const previous = merged.get(session.sessionId)
      merged.set(session.sessionId, clone(newestSession(previous, session) ?? session))
    }
    memoryHistory = sortHistory([...merged.values()].filter((session) => Boolean(session.finishedAt)))
    memoryActive = localActive
    rebuildProfiles(memoryHistory)
    writeLocalHistoryMirror(memoryHistory, true)
    return { backend: 'localStorage' as const, migratedSessions: 0 }
  }

  indexedDbReady = true

  let indexedSessions: WorkoutSession[] = []
  let indexedActiveRecord: ActiveStateRecord | null = null
  try {
    ;[indexedSessions, indexedActiveRecord] = await Promise.all([
      readIndexedSessions(db),
      readIndexedActive(db)
    ])
  } catch {
    indexedDbReady = false
    const fallback = new Map<string, WorkoutSession>()
    for (const session of [...legacyAnalytics, ...localHistory]) {
      if (!session?.sessionId || !session.finishedAt) continue
      const previous = fallback.get(session.sessionId)
      fallback.set(session.sessionId, clone(newestSession(previous, session) ?? session))
    }
    memoryHistory = sortHistory([...fallback.values()])
    memoryActive = localActive
    rebuildProfiles(memoryHistory)
    writeLocalHistoryMirror(memoryHistory, true)
    return { backend: 'localStorage' as const, migratedSessions: 0 }
  }

  const merged = new Map<string, WorkoutSession>()
  for (const session of [...indexedSessions, ...legacyAnalytics, ...localHistory]) {
    if (!session?.sessionId || !session.finishedAt) continue
    const previous = merged.get(session.sessionId)
    merged.set(session.sessionId, clone(newestSession(previous, session) ?? session))
  }

  let mergedHistory = sortHistory([...merged.values()])
  const indexedIds = new Set(indexedSessions.map((session) => session.sessionId))
  const sessionsToPersist = mergedHistory.filter((session) => {
    const indexed = indexedSessions.find((item) => item.sessionId === session.sessionId)
    return !indexedIds.has(session.sessionId) || sessionTime(session) > sessionTime(indexed!)
  })

  try {
    await writeIndexedSessions(db, sessionsToPersist)
  } catch {
    indexedDbReady = false
    memoryHistory = mergedHistory
    const indexedActive = indexedActiveRecord?.value ?? null
    memoryActive = newestSession(indexedActive ?? undefined, localActive ?? undefined) ?? null
    rebuildProfiles(memoryHistory)
    writeLocalHistoryMirror(memoryHistory, true)
    return { backend: 'localStorage' as const, migratedSessions: 0 }
  }

  const indexedActive = indexedActiveRecord?.value ?? null
  const indexedActiveStamp = indexedActiveRecord ? new Date(indexedActiveRecord.updatedAt).getTime() : -Infinity
  const localActiveStamp = localActive ? sessionTime(localActive) : -Infinity

  let active: WorkoutSession | null
  if (indexedActiveRecord && indexedActiveStamp >= localActiveStamp) {
    // A null value is an intentional tombstone (for example after "Удалить").
    active = indexedActive ? clone(indexedActive) : null
  } else {
    active = localActive ? clone(localActive) : null
    if (active) await writeIndexedActive(active)
  }

  if (active?.finishedAt) {
    const archived = mergedHistory.find((session) => session.sessionId === active.sessionId)
    if (!archived || sessionTime(active) > sessionTime(archived)) {
      mergedHistory = sortHistory([clone(active), ...mergedHistory.filter((session) => session.sessionId !== active.sessionId)])
      try {
        await writeIndexedSessions(db, [active])
      } catch {
        indexedDbReady = false
      }
    }
  }

  memoryHistory = mergedHistory
  memoryActive = active
  rebuildProfiles(memoryHistory)

  writeLocalHistoryMirror(memoryHistory, !indexedDbReady)
  try {
    if (memoryActive) localStorage.setItem(ACTIVE_KEY, JSON.stringify(memoryActive))
    else localStorage.removeItem(ACTIVE_KEY)
    // This legacy archive has now been merged into IndexedDB.
    localStorage.removeItem(ANALYTICS_HISTORY_KEY)
  } catch {
    // IndexedDB remains canonical even if the compatibility mirror is unavailable.
  }

  return {
    backend: 'indexedDB' as const,
    migratedSessions: sessionsToPersist.length
  }
}

export function isIndexedDbStorage() {
  return indexedDbReady
}

export function loadActiveSession(): WorkoutSession | null {
  if (memoryActive !== undefined) return memoryActive ? clone(memoryActive) : null
  return readLocalActive()
}

export function saveActiveSession(session: WorkoutSession | null) {
  memoryActive = session ? clone(session) : null

  let localOk = false
  try {
    if (!session) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, JSON.stringify(session))
    localOk = true
  } catch {
    localOk = false
  }

  // Keep UI writes synchronous while serializing the same state to IndexedDB.
  // Serial writes prevent an older keystroke from landing after a newer one.
  void queueIndexedActiveWrite(session)
  return indexedDbReady || localOk
}

export async function saveActiveSessionDurable(session: WorkoutSession | null) {
  const localOk = saveActiveSession(session)
  if (!indexedDbReady) return localOk
  const indexedOk = await activeWriteChain
  return indexedOk
}

export function loadExerciseProfiles(): ExerciseProfiles {
  if (memoryProfiles) return clone(memoryProfiles)

  // Before async bootstrap completes, allow the old cache to render safely.
  try {
    const raw = localStorage.getItem(EXERCISE_PROFILES_KEY)
    return raw ? (JSON.parse(raw) as ExerciseProfiles) : {}
  } catch {
    return {}
  }
}

export async function archiveSession(session: WorkoutSession) {
  const current = memoryHistory ?? readLocalHistory()
  const nextHistory = sortHistory([clone(session), ...current.filter((x) => x.sessionId !== session.sessionId)])
  memoryHistory = nextHistory

  const indexedOk = indexedDbReady ? await putIndexedSession(session) : false
  if (indexedDbReady && !indexedOk) indexedDbReady = false
  const localOk = writeLocalHistoryMirror(nextHistory, !indexedDbReady)

  const profiles = memoryProfiles ?? {}
  memoryProfiles = updateExerciseProfilesFromSession(profiles, session)

  return indexedOk || localOk
}

export function loadHistory(): WorkoutSession[] {
  if (memoryHistory) return clone(memoryHistory)
  return readLocalHistory()
}
