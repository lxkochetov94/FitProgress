import { loadHistory } from './storage'
import type { WorkoutSession, WorkoutSet } from './types'
import type { RetroWorkoutTuple } from './analyticsSeedTypes'
import { RETRO_JUN } from './analyticsSeedJun'
import { RETRO_JUL } from './analyticsSeedJul'
import { RETRO_AUG } from './analyticsSeedAug'
import { RETRO_SEP } from './analyticsSeedSep'
import { getDefinition } from './exerciseLibrary'

export type AnalyticsPeriod = '1m' | '3m' | '6m' | '12m'

export interface AnalyticsSet {
  label: string
  weight: string
  reps: string
  intensity: string
  rir?: string
  pain?: string
  kind?: WorkoutSet['setType']
}

export interface AnalyticsExercise {
  exerciseId: string
  name: string
  sets: AnalyticsSet[]
}

export interface AnalyticsWorkout {
  id: string
  order: number
  date: string | null
  periodKey: string
  periodLabel: string
  title: string
  gym: string
  source: 'retro' | 'local'
  exercises: AnalyticsExercise[]
}

export interface ExercisePoint {
  workoutId: string
  order: number
  date: string | null
  periodKey: string
  dateLabel: string
  workoutTitle: string
  matchedExerciseId: string
  matchedExerciseName: string
  score: number
  workWeight: number | null
  peakWeight: number | null
  weightUnit: 'кг' | 'lb' | null
  setReps: (number | null)[]
  totalReps: number | null
  primarySets: AnalyticsSet[]
  allSets: AnalyticsSet[]
  prepSetCount: number
  bodyweight: boolean
}

const ARCHIVE_KEY = 'fitprogress.analytics-history.v1'
const RETRO = [...RETRO_JUN, ...RETRO_JUL, ...RETRO_AUG, ...RETRO_SEP]

/**
 * Only aliases/previous stages that the user expects to see on one historical line.
 * Different machines and unrelated movement variants stay separate.
 */
const ANALYTICS_EQUIVALENTS: Record<string, string[]> = {
  db_shrug: ['db_shrug', 'old_db_shrug'],
  incline_db_press: ['incline_db_press', 'incline_db_press_legacy', 'old_incline_db_press'],
  medium_lever_cable_fly: ['medium_lever_cable_fly', 'short_lever_cable_fly'],
  db_pullover: ['db_pullover', 'old_db_pullover'],
  overhead_cable_extension: ['overhead_cable_extension', 'old_overhead_cable_extension']
}

const equivalentIds = (exerciseId: string) => ANALYTICS_EQUIVALENTS[exerciseId] ?? [exerciseId]
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const numeric = (value?: string) => {
  const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

const looseRepsValue = (value?: string) => {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw || raw === '—') return NaN
  if (raw.includes('+')) {
    const parts = raw.split('+').map(numeric).filter(Number.isFinite)
    return parts.length ? parts.reduce((sum, item) => sum + item, 0) : NaN
  }
  return numeric(raw)
}

const exactRepsValue = (value?: string): number | null => {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw || raw === '—' || /отказ|не запис/i.test(raw)) return null
  if (/\d\s*[–—-]\s*\d/.test(raw)) return null
  if (raw.includes('+')) {
    const parts = raw.split('+').map((part) => numeric(part))
    return parts.length && parts.every(Number.isFinite) ? parts.reduce((sum, item) => sum + item, 0) : null
  }
  const valueNumber = numeric(raw)
  return Number.isFinite(valueNumber) ? valueNumber : null
}

const weightValue = (value?: string) => {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '—' || /BW|собственн/i.test(raw) || /%|усили|без веса/i.test(raw) || /→/.test(raw)) return NaN
  return numeric(raw)
}

const isBodyweight = (value?: string) => /BW|собственн/i.test(String(value ?? ''))

const unitFromWeight = (value?: string): 'кг' | 'lb' | null => {
  const raw = String(value ?? '')
  if (/кг/i.test(raw)) return 'кг'
  if (/\blb\b|lbs/i.test(raw)) return 'lb'
  return null
}

const isPrepSet = (set: AnalyticsSet) =>
  /размин|подвод|подгот|калибр|проб|тест|провокац|прерван|экспоз|контрол|maintenance/i.test(`${set.label} ${set.intensity}`)

const meaningfulSet = (set: AnalyticsSet) => {
  const reps = looseRepsValue(set.reps)
  const weight = weightValue(set.weight)
  return (Number.isFinite(reps) && reps > 0) || (Number.isFinite(weight) && weight > 0) || isBodyweight(set.weight)
}

export function primarySets(exercise: AnalyticsExercise) {
  const meaningful = exercise.sets.filter(meaningfulSet)
  if (!meaningful.length) return []

  const work = meaningful.filter((set) => {
    if (set.kind === 'warmup' || set.kind === 'calibration') return false
    if (isPrepSet(set)) return false
    return true
  })

  // If the source only contains rehab/calibration/exposure sets, do not make
  // the whole training date disappear. Those are still factual completed sets.
  return work.length ? work : meaningful
}

const localSetLabel = (set: WorkoutSet) => {
  if (set.isExtra) return `Доп. сет ${set.setNo}`
  if (set.setType === 'warmup') return 'Разминка'
  if (set.setType === 'calibration') return 'Калибровка'
  if (set.setType === 'rehab') return `Rehab ${set.setNo}`
  return String(set.setNo)
}

function localToAnalytics(session: WorkoutSession, order: number): AnalyticsWorkout {
  const date = session.startedAt.slice(0, 10)
  return {
    id: `local-${session.sessionId}`,
    order,
    date,
    periodKey: date.slice(0, 7),
    periodLabel: date,
    title: session.plan.title,
    gym: 'Новый зал',
    source: 'local',
    exercises: session.plan.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      sets: exercise.sets.filter((set) => set.completed).map((set) => ({
        label: localSetLabel(set),
        weight: set.actualWeight,
        reps: set.actualReps,
        intensity: set.actualRir ? `RIR ${set.actualRir}` : '',
        rir: set.actualRir,
        pain: set.pain,
        kind: set.setType
      }))
    })).filter((exercise) => exercise.sets.some(meaningfulSet))
  }
}

function retroToAnalytics(tuple: RetroWorkoutTuple): AnalyticsWorkout {
  const [id, order, date, periodKey, periodLabel, gym, title, exercises] = tuple
  return {
    id,
    order,
    date,
    periodKey,
    periodLabel,
    gym,
    title,
    source: 'retro',
    exercises: exercises.map(([exerciseId, name, sets]) => ({
      exerciseId,
      name,
      sets: sets.map(([label, weight, reps, intensity]) => ({ label, weight, reps, intensity }))
    }))
  }
}

function readArchive(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY)
    return raw ? JSON.parse(raw) as WorkoutSession[] : []
  } catch {
    return []
  }
}

export function syncAnalyticsArchive(history: WorkoutSession[] = loadHistory()) {
  try {
    const existing = readArchive()
    const map = new Map(existing.map((session) => [session.sessionId, session]))
    for (const session of history) map.set(session.sessionId, clone(session))
    const merged = [...map.values()]
      .filter((session) => Boolean(session.finishedAt))
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 260)
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(merged))
  } catch {
    // Analytics is read-only relative to the workout core.
  }
}

export function loadAnalyticsWorkouts(): AnalyticsWorkout[] {
  const current = loadHistory()
  syncAnalyticsArchive(current)
  const archive = readArchive()
  const sessions = new Map<string, WorkoutSession>()
  for (const session of [...archive, ...current]) if (session.finishedAt) sessions.set(session.sessionId, session)

  const local = [...sessions.values()]
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .map((session, index) => localToAnalytics(session, 1000 + index))

  return [...RETRO.map(retroToAnalytics), ...local]
}

export function latestWorkout(workouts: AnalyticsWorkout[]) {
  return [...workouts].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || b.order - a.order
    if (a.date) return -1
    if (b.date) return 1
    return b.order - a.order
  })[0]
}

const periodDays: Record<AnalyticsPeriod, number> = { '1m': 31, '3m': 93, '6m': 186, '12m': 366 }

export function filterByPeriod(workouts: AnalyticsWorkout[], period: AnalyticsPeriod, anchorDate?: string | null) {
  const exactDates = workouts.map((item) => item.date).filter(Boolean) as string[]
  const anchor = anchorDate ?? exactDates.sort().at(-1) ?? new Date().toISOString().slice(0, 10)
  const cutoff = new Date(`${anchor}T12:00:00`)
  cutoff.setDate(cutoff.getDate() - periodDays[period])
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  const cutoffMonth = cutoffIso.slice(0, 7)
  return workouts.filter((item) => item.date ? item.date >= cutoffIso && item.date <= anchor : item.periodKey >= cutoffMonth && item.periodKey <= anchor.slice(0, 7))
}

const maxWeight = (sets: AnalyticsSet[]) => {
  const values = sets.map((set) => weightValue(set.weight)).filter(Number.isFinite) as number[]
  return values.length ? Math.max(...values) : null
}

export function pointForExercise(workout: AnalyticsWorkout, exerciseId: string): ExercisePoint | null {
  const acceptedIds = equivalentIds(exerciseId)
  const exercise = workout.exercises.find((item) => acceptedIds.includes(item.exerciseId))
  if (!exercise) return null

  const allSets = exercise.sets.filter(meaningfulSet)
  if (!allSets.length) return null
  const primary = primarySets(exercise)
  const workWeight = maxWeight(primary)
  const peakWeight = maxWeight(allSets)
  const exactReps = primary.map((set) => exactRepsValue(set.reps))
  const exactRepValues = exactReps.filter((value): value is number => value != null)
  const totalReps = exactReps.length && exactReps.every((value) => value != null)
    ? exactRepValues.reduce((sum, value) => sum + value, 0)
    : null
  const bodyweight = primary.some((set) => isBodyweight(set.weight))
  const score = workWeight ?? (exactRepValues.length ? Math.max(...exactRepValues) : 0)
  const unit = [...primary, ...allSets].map((set) => unitFromWeight(set.weight)).find(Boolean) ?? null

  return {
    workoutId: workout.id,
    order: workout.order,
    date: workout.date,
    periodKey: workout.periodKey,
    dateLabel: workout.date
      ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(new Date(`${workout.date}T12:00:00`))
      : workout.periodLabel,
    workoutTitle: workout.title,
    matchedExerciseId: exercise.exerciseId,
    matchedExerciseName: exercise.name,
    score,
    workWeight,
    peakWeight,
    weightUnit: unit,
    setReps: exactReps,
    totalReps,
    primarySets: primary,
    allSets,
    prepSetCount: Math.max(0, allSets.length - primary.length),
    bodyweight
  }
}

export function exerciseSeries(workouts: AnalyticsWorkout[], exerciseId: string) {
  return workouts
    .map((workout) => pointForExercise(workout, exerciseId))
    .filter(Boolean)
    .sort((a, b) => a!.order - b!.order) as ExercisePoint[]
}

export interface IndexPoint {
  workoutId: string
  dateLabel: string
  value: number
  order: number
  count: number
}

export function overallStrengthIndex(workouts: AnalyticsWorkout[], exerciseIds: string[]) {
  const strengthIds = exerciseIds.filter((exerciseId) => !getDefinition(exerciseId)?.rehab)
  const candidates = strengthIds.length ? strengthIds : exerciseIds
  const series = candidates.map((exerciseId) => exerciseSeries(workouts, exerciseId)).filter((items) => items.length >= 2)
  const usable = series.length ? series : candidates.map((exerciseId) => exerciseSeries(workouts, exerciseId)).filter((items) => items.length)
  const buckets = new Map<string, { order: number; dateLabel: string; values: number[] }>()

  for (const points of usable) {
    const baseline = points[0]?.score
    if (!baseline || baseline <= 0) continue
    for (const point of points) {
      const normalized = point.score / baseline * 100
      const current = buckets.get(point.workoutId) ?? { order: point.order, dateLabel: point.dateLabel, values: [] }
      current.values.push(normalized)
      buckets.set(point.workoutId, current)
    }
  }

  return [...buckets.entries()]
    .map(([workoutId, bucket]) => ({
      workoutId,
      order: bucket.order,
      dateLabel: bucket.dateLabel,
      value: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
      count: bucket.values.length
    }))
    .sort((a, b) => a.order - b.order)
}

export function formatMetric(value: number, decimals = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: decimals }).format(value)
}
