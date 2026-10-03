import type { AnalyticsExercise, AnalyticsSet, AnalyticsWorkout } from './analyticsModel'
import { findDefinition } from './exerciseLibrary'
import { localDateKey } from './dateUtils'

export type StimulusStatus = 'fresh' | 'within72' | 'due' | 'high' | 'none'

export interface MuscleStimulusSummary {
  muscle: string
  effectiveSets7d: number
  directSets7d: number
  indirectSets7d: number
  lastAnyDate: string | null
  lastDirectDate: string | null
  daysSinceAny: number | null
  daysSinceDirect: number | null
  status: StimulusStatus
  explanation: string
}

export interface PatternRecencySummary {
  pattern: string
  lastDate: string | null
  daysSince: number | null
  sessions7d: number
  workingSets7d: number
  overdue: boolean
}

export interface StimulusDashboard {
  anchorDate: string
  muscles: MuscleStimulusSummary[]
  patterns: PatternRecencySummary[]
}

const TRACKED_MUSCLES = [
  'Грудь',
  'Спина',
  'Плечи',
  'Задняя дельта',
  'Бицепс',
  'Трицепс',
  'Квадрицепс',
  'Бицепс бедра',
  'Ягодичные',
  'Приводящие',
  'Трапеции',
  'Предплечья'
]

const PATTERN_LOADS: Record<string, Record<string, number>> = {
  'Вертикальная тяга': { 'Спина': 1, 'Бицепс': .5, 'Задняя дельта': .25, 'Предплечья': .25 },
  'Горизонтальная тяга': { 'Спина': 1, 'Бицепс': .5, 'Задняя дельта': .5, 'Предплечья': .25 },
  'Разгибание плеча': { 'Спина': 1, 'Трицепс': .25 },
  'Горизонтальное разгибание плеча': { 'Задняя дельта': 1, 'Спина': .25 },
  'Задняя дельта': { 'Задняя дельта': 1, 'Спина': .25 },

  'Горизонтальный жим': { 'Грудь': 1, 'Трицепс': .5, 'Плечи': .5 },
  'Наклонный жим': { 'Грудь': 1, 'Плечи': .5, 'Трицепс': .5 },
  'Жим собственным весом': { 'Грудь': 1, 'Трицепс': .75, 'Плечи': .25 },
  'Горизонтальное приведение': { 'Грудь': 1, 'Плечи': .25 },
  'Вертикальный жим': { 'Плечи': 1, 'Трицепс': .5, 'Грудь': .25 },
  'Отведение плеча': { 'Плечи': 1 },
  'Scaption': { 'Плечи': 1 },

  'Сгибание локтя': { 'Бицепс': 1, 'Предплечья': .25 },
  'Разгибание локтя': { 'Трицепс': 1 },
  'Элевация лопатки': { 'Трапеции': 1 },

  'Жим ногами': { 'Квадрицепс': 1, 'Ягодичные': .5, 'Бицепс бедра': .25, 'Приводящие': .25 },
  'Присед': { 'Квадрицепс': 1, 'Ягодичные': .75, 'Бицепс бедра': .25, 'Приводящие': .25 },
  'Одноногий присед': { 'Квадрицепс': 1, 'Ягодичные': .75, 'Бицепс бедра': .25 },
  'Выпад': { 'Квадрицепс': 1, 'Ягодичные': .75, 'Бицепс бедра': .25 },
  'Разгибание колена': { 'Квадрицепс': 1 },
  'Сгибание колена': { 'Бицепс бедра': 1 },
  'Hip hinge': { 'Бицепс бедра': 1, 'Ягодичные': 1, 'Спина': .25 },
  'Отведение бедра': { 'Ягодичные': 1 },
  'Приведение бедра': { 'Приводящие': 1 },

  'Наружная ротация': { 'Плечи': 1 },
  'Внутренняя ротация': { 'Плечи': 1 }
}

const PRIMARY_MUSCLE: Record<string, Record<string, number>> = {
  'Грудь': { 'Грудь': 1 },
  'Спина': { 'Спина': 1 },
  'Плечи': { 'Плечи': 1 },
  'Задняя дельта': { 'Задняя дельта': 1 },
  'Бицепс': { 'Бицепс': 1 },
  'Трицепс': { 'Трицепс': 1 },
  'Квадрицепс': { 'Квадрицепс': 1 },
  'Бицепс бедра': { 'Бицепс бедра': 1 },
  'Ягодичные': { 'Ягодичные': 1 },
  'Приводящие': { 'Приводящие': 1 },
  'Трапеции': { 'Трапеции': 1 },
  'Предплечья': { 'Предплечья': 1 },
  'Задняя цепь': { 'Бицепс бедра': 1, 'Ягодичные': 1 }
}

const numeric = (value?: string) => {
  const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

const hasUsableReps = (set: AnalyticsSet) => {
  const raw = String(set.reps ?? '').trim()
  if (!raw || raw === '—' || /не запис/i.test(raw)) return false
  const reps = numeric(raw)
  return (Number.isFinite(reps) && reps > 0) || /отказ/i.test(raw)
}

const isTrainingSet = (set: AnalyticsSet) => {
  if (!hasUsableReps(set)) return false

  if (set.kind) {
    if (set.kind === 'warmup' || set.kind === 'calibration' || set.kind === 'rehab') return false
    return set.kind === 'working' || set.kind === 'other' || /доп\.?\s*сет/i.test(set.label)
  }

  const text = `${set.label} ${set.intensity}`.toLowerCase()
  if (/размин|подвод|подгот|калибр|rehab|реабил|проб|тест|экспоз|контрол|maintenance|прерван|стоп/.test(text)) return false
  return true
}

const exerciseMeta = (exercise: AnalyticsExercise) => {
  const def = findDefinition(exercise.exerciseId, exercise.name)
  return {
    muscleGroup: def?.muscleGroup ?? '',
    movementPattern: def?.movementPattern ?? ''
  }
}

const exerciseLoads = (exercise: AnalyticsExercise) => {
  const { muscleGroup, movementPattern } = exerciseMeta(exercise)
  const result: Record<string, number> = {}

  for (const [muscle, value] of Object.entries(PATTERN_LOADS[movementPattern] ?? {})) {
    result[muscle] = Math.max(result[muscle] ?? 0, value)
  }
  for (const [muscle, value] of Object.entries(PRIMARY_MUSCLE[muscleGroup] ?? {})) {
    result[muscle] = Math.max(result[muscle] ?? 0, value)
  }

  return result
}

const dayNumber = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86400000
}

const daysBetween = (later: string, earlier: string) => Math.max(0, Math.round(dayNumber(later) - dayNumber(earlier)))

const laterDate = (a: string | null, b: string) => !a || b > a ? b : a

function statusFor(daysSinceAny: number | null): Pick<MuscleStimulusSummary, 'status' | 'explanation'> {
  if (daysSinceAny == null) return { status: 'none', explanation: 'Нет точной датированной рабочей нагрузки.' }
  if (daysSinceAny <= 1) return { status: 'fresh', explanation: 'Последний рабочий стимул был сегодня или вчера.' }
  if (daysSinceAny <= 3) return { status: 'within72', explanation: 'Последний прямой или косвенный стимул был в пределах 3 календарных дней.' }
  if (daysSinceAny <= 4) return { status: 'due', explanation: 'Прошло 4 календарных дня — мышцу уже желательно вернуть в работу.' }
  return { status: 'high', explanation: 'Более 4 календарных дней без значимой рабочей нагрузки — высокий приоритет следующей тренировки.' }
}

export function buildStimulusDashboard(workouts: AnalyticsWorkout[], anchorDate = localDateKey()): StimulusDashboard {
  const muscleState = new Map(TRACKED_MUSCLES.map((muscle) => [muscle, {
    effectiveSets7d: 0,
    directSets7d: 0,
    indirectSets7d: 0,
    lastAnyDate: null as string | null,
    lastDirectDate: null as string | null
  }]))

  const patternState = new Map<string, {
    lastDate: string | null
    sessions7d: Set<string>
    workingSets7d: number
  }>()

  for (const workout of workouts) {
    if (!workout.date || workout.date > anchorDate) continue
    const daysAgo = daysBetween(anchorDate, workout.date)

    for (const exercise of workout.exercises) {
      const trainingSets = exercise.sets.filter(isTrainingSet)
      if (!trainingSets.length) continue

      const meta = exerciseMeta(exercise)
      const loads = exerciseLoads(exercise)

      for (const [muscle, coefficient] of Object.entries(loads)) {
        const state = muscleState.get(muscle)
        if (!state || coefficient <= 0) continue

        state.lastAnyDate = laterDate(state.lastAnyDate, workout.date)
        if (coefficient >= 1) state.lastDirectDate = laterDate(state.lastDirectDate, workout.date)

        if (daysAgo <= 7) {
          const contribution = trainingSets.length * coefficient
          state.effectiveSets7d += contribution
          if (coefficient >= 1) state.directSets7d += contribution
          else state.indirectSets7d += contribution
        }
      }

      if (meta.movementPattern) {
        const current = patternState.get(meta.movementPattern) ?? {
          lastDate: null,
          sessions7d: new Set<string>(),
          workingSets7d: 0
        }
        current.lastDate = laterDate(current.lastDate, workout.date)
        if (daysAgo <= 7) {
          current.sessions7d.add(workout.id)
          current.workingSets7d += trainingSets.length
        }
        patternState.set(meta.movementPattern, current)
      }
    }
  }

  const muscles = [...muscleState.entries()]
    .map(([muscle, state]) => {
      const daysSinceAny = state.lastAnyDate ? daysBetween(anchorDate, state.lastAnyDate) : null
      const daysSinceDirect = state.lastDirectDate ? daysBetween(anchorDate, state.lastDirectDate) : null
      const status = statusFor(daysSinceAny)
      return {
        muscle,
        effectiveSets7d: Number(state.effectiveSets7d.toFixed(2)),
        directSets7d: Number(state.directSets7d.toFixed(2)),
        indirectSets7d: Number(state.indirectSets7d.toFixed(2)),
        lastAnyDate: state.lastAnyDate,
        lastDirectDate: state.lastDirectDate,
        daysSinceAny,
        daysSinceDirect,
        ...status
      }
    })
    .sort((a, b) => {
      const rank: Record<StimulusStatus, number> = { high: 4, due: 3, none: 2, within72: 1, fresh: 0 }
      return rank[b.status] - rank[a.status] ||
        (b.daysSinceAny ?? -1) - (a.daysSinceAny ?? -1) ||
        a.muscle.localeCompare(b.muscle, 'ru')
    })

  const patterns = [...patternState.entries()]
    .map(([pattern, state]) => {
      const daysSince = state.lastDate ? daysBetween(anchorDate, state.lastDate) : null
      return {
        pattern,
        lastDate: state.lastDate,
        daysSince,
        sessions7d: state.sessions7d.size,
        workingSets7d: state.workingSets7d,
        overdue: daysSince != null && daysSince > 3
      }
    })
    // Only show patterns that are actually part of the recent training rotation.
    // Old/abandoned movements should not remain "overdue" forever.
    .filter((item) => item.daysSince != null && item.daysSince <= 30)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) ||
      (b.daysSince ?? -1) - (a.daysSince ?? -1) ||
      a.pattern.localeCompare(b.pattern, 'ru'))

  return { anchorDate, muscles, patterns }
}
