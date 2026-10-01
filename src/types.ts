export type SetType = 'warmup' | 'calibration' | 'working' | 'rehab' | 'other'
export type PerSide = 'arm' | 'leg' | 'side'
export type WeightUnit = 'kg' | 'lb'

export interface WorkoutSet {
  id: string
  setNo: number
  setType: SetType
  targetWeight: string
  targetReps: string
  targetRir: string
  restSec: number
  notes?: string
  actualWeight: string
  actualReps: string
  actualRir: string
  pain: string
  comment: string
  completed: boolean
  completedAt?: string
}

export interface ExerciseSnapshot {
  exerciseId: string
  category: string
  name: string
  muscleGroup: string
  movementPattern: string
  equipment: string
  rehab: boolean
  instruction: string
  image?: string
  badge?: string
  perSide?: PerSide
  weightUnit?: WeightUnit
  known?: boolean
  gym?: 'Старый зал' | 'Новый зал' | string
  suitability?: 'known' | 'caution' | 'avoid'
  warmupKnown?: string
  lastKnown?: string
  bestKnown?: string
  historyNote?: string
  rehabStatus?: string
  lastPain?: string
  rehabNote?: string
  lastRehabDate?: string
  aliases?: string[]
}

export interface WorkoutExercise {
  instanceId: string
  exerciseId: string
  originalExerciseId: string
  originalName: string
  order: number
  section?: string
  category: string
  name: string
  muscleGroup: string
  movementPattern: string
  equipment: string
  rehab: boolean
  instruction: string
  image?: string
  badge?: string
  perSide?: PerSide
  weightUnit?: WeightUnit
  startedAt?: string
  finishedAt?: string
  sets: WorkoutSet[]
  replacementReason?: 'Занято' | 'Дискомфорт' | 'Другое'
  replacedAt?: string
  originalSnapshot?: ExerciseSnapshot
}

export interface WorkoutPlan {
  workoutId: string
  title: string
  priority: string
  notes: string
  exercises: WorkoutExercise[]
}

export interface WorkoutSession {
  sessionId: string
  plan: WorkoutPlan
  startedAt: string
  finishedAt?: string
  updatedAt: string
  archived?: boolean
}

export interface ExerciseDefinition {
  id: string
  name: string
  category: string
  muscleGroup: string
  movementPattern: string
  equipment: string
  rehab?: boolean
  instruction?: string
  badge?: string
  defaultSets?: number
  defaultReps?: string
  icon?: string
  perSide?: PerSide
  weightUnit?: WeightUnit
}
