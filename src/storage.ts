import type { WorkoutSession } from './types'
import { updateExerciseProfilesFromSession } from './exerciseProgress'
import type { ExerciseProfiles } from './exerciseProgress'

const ACTIVE_KEY = 'fitprogress.active-session.v1'
const HISTORY_KEY = 'fitprogress.history.v1'
const TEST_HISTORY_RESET_KEY = 'fitprogress.test-history-reset.2026-10-02.v2'
const ANALYTICS_HISTORY_KEY = 'fitprogress.analytics-history.v1'
const EXERCISE_PROFILES_KEY = 'fitprogress.exercise-profiles.v1'

export function clearTestWorkoutHistoryOnce() {
  try {
    if (localStorage.getItem(TEST_HISTORY_RESET_KEY)) return

    // One-time production reset immediately before the first real FitProgress workout.
    // Remove all locally generated test sessions and their learned/analytics traces.
    // The embedded retrospective (real workouts from the revision) lives in code and is untouched.
    localStorage.removeItem(HISTORY_KEY)
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(EXERCISE_PROFILES_KEY)
    localStorage.removeItem(ANALYTICS_HISTORY_KEY)
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

export function loadExerciseProfiles(): ExerciseProfiles {
  try {
    const raw = localStorage.getItem(EXERCISE_PROFILES_KEY)
    return raw ? (JSON.parse(raw) as ExerciseProfiles) : {}
  } catch {
    return {}
  }
}

export function archiveSession(session: WorkoutSession) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history = raw ? (JSON.parse(raw) as WorkoutSession[]) : []
    const nextHistory = [session, ...history.filter((x) => x.sessionId !== session.sessionId)].slice(0, 30)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))

    const profiles = loadExerciseProfiles()
    const nextProfiles = updateExerciseProfilesFromSession(profiles, session)
    localStorage.setItem(EXERCISE_PROFILES_KEY, JSON.stringify(nextProfiles))
  } catch {
    // The active session still remains exportable even if persistent storage fails.
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
