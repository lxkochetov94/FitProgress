import type { ExerciseDefinition, PerSide, WeightUnit, WorkoutExercise, WorkoutSession, WorkoutSet } from './types'

export interface ExerciseHistorySet {
  setNo: number
  setType: WorkoutSet['setType']
  weight: string
  reps: string
  rir: string
  pain: string
  comment: string
  isExtra?: boolean
}

export interface ExerciseHistoryEntry {
  sessionId: string
  workoutId: string
  workoutTitle: string
  performedAt: string
  finishedAt?: string
  finishMode?: WorkoutExercise['finishMode']
  replacementReason?: WorkoutExercise['replacementReason']
  sets: ExerciseHistorySet[]
}

export interface ExerciseProfile {
  exerciseId: string
  name: string
  category: string
  muscleGroup: string
  movementPattern: string
  equipment: string
  rehab: boolean
  perSide?: PerSide
  weightUnit: WeightUnit
  sessions: number
  lastPerformedAt: string
  lastKnown?: string
  bestKnown?: string
  bestScore?: number
  lastRir?: string
  lastPain?: string
  lastComment?: string
  latestSetsSummary?: string
  history: ExerciseHistoryEntry[]
}

export type ExerciseProfiles = Record<string, ExerciseProfile>

const numeric = (value?: string) => {
  const match = String(value ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

const unitLabel = (unit: WeightUnit) => unit === 'lb' ? 'lbs' : 'кг'

const performedSets = (exercise: WorkoutExercise) => {
  const completed = exercise.sets.filter((set) => set.completed)
  const meaningful = completed.filter((set) =>
    set.setType === 'working' || set.setType === 'rehab' || set.setType === 'other' || set.isExtra
  )
  return meaningful.length ? meaningful : completed
}

const setLabel = (set: WorkoutSet, unit: WeightUnit) => {
  const weight = set.actualWeight.trim()
  const reps = set.actualReps.trim()
  if (weight && reps) return `${weight} ${unitLabel(unit)} ×${reps}`
  if (reps) return `×${reps}`
  if (weight) return `${weight} ${unitLabel(unit)}`
  return ''
}

function summarizeSets(sets: WorkoutSet[], unit: WeightUnit) {
  const labels = sets.map((set) => setLabel(set, unit)).filter(Boolean)
  if (!labels.length) return undefined

  const grouped: { label: string; count: number }[] = []
  for (const label of labels) {
    const previous = grouped[grouped.length - 1]
    if (previous?.label === label) previous.count += 1
    else grouped.push({ label, count: 1 })
  }

  return grouped
    .slice(0, 4)
    .map((item) => item.count > 1 ? `${item.label} (${item.count} сета)` : item.label)
    .join(' · ')
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function bestSetCandidate(sets: WorkoutSet[], unit: WeightUnit) {
  let best: { score: number; label: string } | undefined
  for (const set of sets) {
    const weight = numeric(set.actualWeight)
    const reps = numeric(set.actualReps)
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) continue
    const score = weight * (1 + reps / 30)
    const label = setLabel(set, unit)
    if (!best || score > best.score) best = { score, label }
  }
  return best
}

export function updateExerciseProfilesFromSession(existing: ExerciseProfiles, session: WorkoutSession): ExerciseProfiles {
  const next: ExerciseProfiles = JSON.parse(JSON.stringify(existing ?? {}))

  for (const exercise of session.plan.exercises) {
    const sets = performedSets(exercise)
    if (!sets.length) continue

    const unit = exercise.weightUnit ?? 'kg'
    const previous = next[exercise.exerciseId]
    const historyWithoutSameSession = (previous?.history ?? []).filter((entry) => entry.sessionId !== session.sessionId)

    const entry: ExerciseHistoryEntry = {
      sessionId: session.sessionId,
      workoutId: session.plan.workoutId,
      workoutTitle: session.plan.title,
      performedAt: session.startedAt,
      finishedAt: exercise.finishedAt,
      finishMode: exercise.finishMode,
      replacementReason: exercise.replacementReason,
      sets: sets.map((set) => ({
        setNo: set.setNo,
        setType: set.setType,
        weight: set.actualWeight,
        reps: set.actualReps,
        rir: set.actualRir,
        pain: set.pain,
        comment: set.comment,
        isExtra: set.isExtra
      }))
    }

    const rirValues = uniqueValues(sets.map((set) => set.actualRir))
    const painValues = uniqueValues(sets.map((set) => set.pain))
    const comments = sets.map((set) => set.comment.trim()).filter(Boolean)
    const latestSummary = summarizeSets(sets, unit)
    const bestCandidate = exercise.rehab ? undefined : bestSetCandidate(sets, unit)

    let bestKnown = previous?.bestKnown
    let bestScore = previous?.bestScore
    if (bestCandidate && (!Number.isFinite(bestScore) || bestCandidate.score > Number(bestScore))) {
      bestKnown = bestCandidate.label
      bestScore = bestCandidate.score
    }

    next[exercise.exerciseId] = {
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      category: exercise.category,
      muscleGroup: exercise.muscleGroup,
      movementPattern: exercise.movementPattern,
      equipment: exercise.equipment,
      rehab: exercise.rehab,
      perSide: exercise.perSide,
      weightUnit: unit,
      sessions: historyWithoutSameSession.length + 1,
      lastPerformedAt: session.startedAt,
      lastKnown: latestSummary || previous?.lastKnown,
      bestKnown,
      bestScore,
      lastRir: rirValues.length ? rirValues.join(' / ') : previous?.lastRir,
      lastPain: painValues.length ? painValues.join(' / ') : previous?.lastPain,
      lastComment: comments.length ? comments[comments.length - 1] : previous?.lastComment,
      latestSetsSummary: latestSummary || previous?.latestSetsSummary,
      history: [entry, ...historyWithoutSameSession].slice(0, 24)
    }
  }

  return next
}

export function mergeDefinitionWithProfile(definition: ExerciseDefinition, profile?: ExerciseProfile): ExerciseDefinition {
  if (!profile) return definition
  return {
    ...definition,
    known: true,
    gym: 'Новый зал',
    weightUnit: profile.weightUnit ?? definition.weightUnit,
    perSide: profile.perSide ?? definition.perSide,
    lastKnown: profile.lastKnown ?? definition.lastKnown,
    bestKnown: profile.rehab ? definition.bestKnown : (profile.bestKnown ?? definition.bestKnown),
    lastPain: profile.lastPain ?? definition.lastPain,
    historyNote: profile.lastComment
      ? `Последний комментарий: ${profile.lastComment}`
      : definition.historyNote
  }
}

export function profileToDefinition(profile: ExerciseProfile): ExerciseDefinition {
  return {
    id: profile.exerciseId,
    name: profile.name,
    category: profile.category,
    muscleGroup: profile.muscleGroup,
    movementPattern: profile.movementPattern,
    equipment: profile.equipment,
    rehab: profile.rehab,
    perSide: profile.perSide,
    weightUnit: profile.weightUnit,
    known: true,
    gym: 'Новый зал',
    suitability: profile.rehab ? 'caution' : 'known',
    lastKnown: profile.lastKnown,
    bestKnown: profile.rehab ? undefined : profile.bestKnown,
    lastPain: profile.lastPain,
    historyNote: profile.lastComment ? `Последний комментарий: ${profile.lastComment}` : undefined,
    icon: 'NEW'
  }
}
