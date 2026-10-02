import type { WorkoutSession } from './types'

const ACTIVE_KEY = 'fitprogress.active-session.v1'
const HISTORY_KEY = 'fitprogress.history.v1'
const TEST_HISTORY_RESET_KEY = 'fitprogress.test-history-reset.2026-10-02.v1'

export function clearTestWorkoutHistoryOnce() {
  try {
    if (localStorage.getItem(TEST_HISTORY_RESET_KEY)) return

    // One-time production reset before the first real FitProgress workout.
    // Exercise retrospective, rehab profile and known lifts live in the app
    // library/code and are intentionally untouched.
    localStorage.removeItem(HISTORY_KEY)
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.setItem(TEST_HISTORY_RESET_KEY, new Date().toISOString())
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export function loadActiveSession(): WorkoutSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? (JSON.parse(raw) as WorkoutSession) : null
  } catch {
    return null
  }
}

export function saveActiveSession(session: WorkoutSession | null) {
  if (!session) localStorage.removeItem(ACTIVE_KEY)
  else localStorage.setItem(ACTIVE_KEY, JSON.stringify(session))
}

export function archiveSession(session: WorkoutSession) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history = raw ? (JSON.parse(raw) as WorkoutSession[]) : []
    const next = [session, ...history.filter((x) => x.sessionId !== session.sessionId)].slice(0, 30)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // History is convenience only. The active session still remains exportable.
  }
}

export function loadHistory(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as WorkoutSession[]) : []
  } catch {
    return []
  }
}
