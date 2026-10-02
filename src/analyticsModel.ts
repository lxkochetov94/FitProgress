import { loadHistory } from './storage'
import type { WorkoutSession, WorkoutSet } from './types'
import type { RetroWorkoutTuple } from './analyticsSeedTypes'
import { RETRO_JUN } from './analyticsSeedJun'
import { RETRO_JUL } from './analyticsSeedJul'
import { RETRO_AUG } from './analyticsSeedAug'
import { RETRO_SEP } from './analyticsSeedSep'

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
  score: number
  workWeight: number | null
  peakWeight: number | null
  weightUnit: 'кг' | 'lb' | null
  setReps: number[]
  totalReps: number
  primarySets: AnalyticsSet[]
  prepSetCount: number
  bodyweight: boolean
}

const ARCHIVE_KEY = 'fitprogress.analytics-history.v1'
const RETRO = [...RETRO_JUN, ...RETRO_JUL, ...RETRO_AUG, ...RETRO_SEP]

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

const numeric = (value?: string) => {
  const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

const repsValue = (value?: string) => {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw || raw === '—') return NaN
  if (raw.includes('+')) {
    const parts = raw.split('+').map(numeric).filter(Number.isFinite)
    return parts.length ? parts.reduce((sum, item) => sum + item, 0) : NaN
  }
  return numeric(raw)
}

const weightValue = (value?: string) => {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '—' || /BW|собственн/i.test(raw) || /%|усили|без веса/i.test(raw) || /→/.test(raw)) return NaN
  return numeric(raw)
}

const isBodyweight = (value?: string) => /BW|собственн/i.test(String(value ?? ''))

const unitFromWeight = (value?: string): 'кг' | 'lb' | null => {
  const raw = String(value ?? '')
  if (/\blb\b|lbs/i.test(raw)) return 'lb'
  if (/кг/i.test(raw)) return 'кг'
  return null
}

const isPrepLabel = (label?: string) => /размин|подвод|подгот|калибр|пробн|тест|провокац|прерван|экспоз|контрол|maintenance/i.test(String(label ?? ''))

const meaningfulSet = (set: AnalyticsSet) => Number.isFinite(repsValue(set.reps)) && repsValue(set.reps) > 0

export function primarySets(exercise: AnalyticsExercise) {
  const meaningful = exercise.sets.filter(meaningfulSet)
  if (!meaningful.length) return []
  const work = meaningful.filter((set) => set.kind === 'working' || set.kind === 'other' || (!set.kind && !isPrepLabel(set.label)))
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
    // Analytics archive is additive only; workout core must keep working even if storage is restricted.
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

function modeWeight(sets: AnalyticsSet[]) {
  const values = sets.map((set) => weightValue(set.weight)).filter(Number.isFinite) as number[]
  if (!values.length) return null
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

export function pointForExercise(workout: AnalyticsWorkout, exerciseId: string): ExercisePoint | null {
  const exercise = workout.exercises.find((item) => item.exerciseId === exerciseId)
  if (!exercise) return null
  const primary = primarySets(exercise)
  if (!primary.length) return null

  const reps = primary.map((set) => repsValue(set.reps)).filter(Number.isFinite) as number[]
  if (!reps.length) return null
  const weighted = primary
    .map((set) => ({ weight: weightValue(set.weight), reps: repsValue(set.reps) }))
    .filter((item) => Number.isFinite(item.weight) && item.weight > 0 && Number.isFinite(item.reps) && item.reps > 0)
  const bodyweight = primary.some((set) => isBodyweight(set.weight))
  const score = weighted.length
    ? Math.max(...weighted.map((set) => set.weight * (1 + set.reps / 30)))
    : Math.max(...reps)
  const peakWeight = weighted.length ? Math.max(...weighted.map((set) => set.weight)) : null
  const unit = primary.map((set) => unitFromWeight(set.weight)).find(Boolean) ?? null

  return {
    workoutId: workout.id,
    order: workout.order,
    date: workout.date,
    periodKey: workout.periodKey,
    dateLabel: workout.date ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(new Date(`${workout.date}T12:00:00`)) : workout.periodLabel,
    workoutTitle: workout.title,
    score,
    workWeight: modeWeight(primary),
    peakWeight,
    weightUnit: unit,
    setReps: reps,
    totalReps: reps.reduce((sum, value) => sum + value, 0),
    primarySets: primary,
    prepSetCount: Math.max(0, exercise.sets.filter(meaningfulSet).length - primary.length),
    bodyweight
  }
}

export function exerciseSeries(workouts: AnalyticsWorkout[], exerciseId: string) {
  return workouts
    .map((workout) => pointForExercise(workout, exerciseId))
    .filter(Boolean)
    .sort((a, b) => {
      const left = a!.date ?? `${a!.periodKey}-${String(a!.order).padStart(3, '0')}`
      const right = b!.date ?? `${b!.periodKey}-${String(b!.order).padStart(3, '0')}`
      return left.localeCompare(right) || a!.order - b!.order
    }) as ExercisePoint[]
}

export interface IndexPoint {
  workoutId: string
  dateLabel: string
  value: number
  order: number
  count: number
}

export function overallStrengthIndex(workouts: AnalyticsWorkout[], exerciseIds: string[]) {
  const series = exerciseIds.map((exerciseId) => exerciseSeries(workouts, exerciseId)).filter((items) => items.length >= 2)
  const usable = series.length ? series : exerciseIds.map((exerciseId) => exerciseSeries(workouts, exerciseId)).filter((items) => items.length)
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
    .map(([workoutId, bucket]) => ({ workoutId, order: bucket.order, dateLabel: bucket.dateLabel, value: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length, count: bucket.values.length }))
    .sort((a, b) => a.order - b.order)
}

export function formatMetric(value: number, decimals = 0) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: decimals }).format(value)
}
