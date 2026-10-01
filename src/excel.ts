import * as XLSX from 'xlsx'
import type { PerSide, WorkoutExercise, WorkoutPlan, WorkoutSession, WorkoutSet } from './types'
import { getDefinition } from './exerciseLibrary'
import { DEMO_PLAN } from './demo'

const cleanKey = (key: string) => key.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_|_$/g, '')
const str = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim())
const bool = (value: unknown) => ['1', 'true', 'да', 'yes', 'y'].includes(str(value).toLowerCase())
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

const detectPerSide = (value: unknown): PerSide | undefined => {
  const text = str(value).toLowerCase()
  if (!text) return undefined
  if (['arm', 'рука', 'руку', 'руки', 'каждая рука', 'на каждую руку'].includes(text) || /\/\s*(рук|arm)/i.test(text)) return 'arm'
  if (['leg', 'нога', 'ногу', 'ноги', 'каждая нога', 'на каждую ногу'].includes(text) || /\/\s*(ног|leg)/i.test(text)) return 'leg'
  if (['side', 'сторона', 'сторону', 'на каждую сторону'].includes(text) || /\/\s*(сторон|side)/i.test(text)) return 'side'
  return undefined
}

const stripPerSideSuffix = (value: string) =>
  value.replace(/\s*\/\s*(?:руку|руки|рук|ногу|ноги|ног|сторону|стороны|сторон|arm|leg|side)\b.*$/i, '').trim()

function normalizedRows(sheet?: XLSX.WorkSheet) {
  if (!sheet) return [] as Record<string, unknown>[]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [cleanKey(k), v])))
}

function rowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const normalized = cleanKey(key)
    if (normalized in row) return row[normalized]
  }
  return ''
}

function newSet(exerciseId: string, row: Record<string, unknown>, index: number): WorkoutSet {
  const setNo = num(rowValue(row, 'set_no', 'set', 'подход'), index + 1)
  const targetWeight = str(rowValue(row, 'target_weight', 'weight', 'вес', 'план_вес'))
  const targetReps = str(rowValue(row, 'target_reps', 'reps', 'повторы', 'план_повторы'))
  return {
    id: `${exerciseId}-${setNo}-${index}`,
    setNo,
    setType: (str(rowValue(row, 'set_type', 'type', 'тип_подхода')) || 'working') as WorkoutSet['setType'],
    targetWeight,
    targetReps,
    targetRir: str(rowValue(row, 'target_rir', 'rir', 'план_rir')),
    restSec: num(rowValue(row, 'rest_sec', 'rest', 'отдых_сек'), 90),
    notes: str(rowValue(row, 'notes', 'set_notes', 'заметка')),
    actualWeight: targetWeight,
    actualReps: targetReps,
    actualRir: '',
    pain: '',
    comment: '',
    completed: false
  }
}

export async function importWorkout(file: File): Promise<WorkoutPlan> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetByName = (name: string) => workbook.Sheets[workbook.SheetNames.find((x) => cleanKey(x) === cleanKey(name)) ?? '']
  const workoutRows = normalizedRows(sheetByName('Workout'))
  const exerciseRows = normalizedRows(sheetByName('Exercises'))
  const setRows = normalizedRows(sheetByName('Sets'))

  if (!exerciseRows.length || !setRows.length) {
    throw new Error('В Excel нужны листы Exercises и Sets. Скачай шаблон в FitProgress — там уже правильная структура.')
  }

  const meta = workoutRows[0] ?? {}
  const exercises: WorkoutExercise[] = exerciseRows
    .map((row, index) => {
      const exerciseId = str(rowValue(row, 'exercise_id', 'id')) || `exercise_${index + 1}`
      const def = getDefinition(exerciseId)
      const name = str(rowValue(row, 'name', 'exercise_name', 'упражнение')) || def?.name || exerciseId
      const rawSets = setRows
        .filter((setRow) => str(rowValue(setRow, 'exercise_id', 'id')) === exerciseId)
        .map((setRow, setIndex) => newSet(exerciseId, setRow, setIndex))
        .sort((a, b) => a.setNo - b.setNo)
      const perSide =
        detectPerSide(rowValue(row, 'per_side', 'per_side_label', 'на_сторону')) ||
        rawSets.map((set) => detectPerSide(set.targetReps)).find(Boolean) ||
        def?.perSide
      const setsForExercise = perSide
        ? rawSets.map((set) => ({ ...set, targetReps: stripPerSideSuffix(set.targetReps), actualReps: stripPerSideSuffix(set.actualReps) }))
        : rawSets

      return {
        instanceId: `${exerciseId}-${index}-${Date.now()}`,
        exerciseId,
        originalExerciseId: exerciseId,
        originalName: name,
        order: num(rowValue(row, 'order', 'порядок'), index + 1),
        category: str(rowValue(row, 'category', 'категория')) || def?.category || '',
        name,
        muscleGroup: str(rowValue(row, 'muscle_group', 'muscle', 'мышечная_группа')) || def?.muscleGroup || '',
        movementPattern: str(rowValue(row, 'movement_pattern', 'pattern', 'паттерн')) || def?.movementPattern || '',
        equipment: str(rowValue(row, 'equipment', 'оборудование')) || def?.equipment || '',
        rehab: bool(rowValue(row, 'rehab', 'реабилитация')) || Boolean(def?.rehab),
        instruction: str(rowValue(row, 'instruction', 'description', 'описание')) || def?.instruction || '',
        image: str(rowValue(row, 'image', 'image_url', 'картинка')) || undefined,
        badge: str(rowValue(row, 'badge', 'плашка')) || def?.badge,
        perSide,
        sets: setsForExercise.length ? setsForExercise : [newSet(exerciseId, {}, 0)]
      }
    })
    .sort((a, b) => a.order - b.order)

  return {
    workoutId: str(rowValue(meta, 'workout_id', 'id')) || `workout-${Date.now()}`,
    title: str(rowValue(meta, 'title', 'название')) || file.name.replace(/\.xlsx?$/i, ''),
    priority: str(rowValue(meta, 'priority', 'приоритет')),
    notes: str(rowValue(meta, 'notes', 'заметки')),
    exercises
  }
}

function setTypeLabel(type: WorkoutSet['setType']) {
  return ({ warmup: 'Разминка', calibration: 'Калибровка', working: 'Рабочий', rehab: 'Rehab', other: 'Подход' } as Record<string, string>)[type] || type
}

export function exportSession(session: WorkoutSession) {
  const workoutRows = [{
    session_id: session.sessionId,
    workout_id: session.plan.workoutId,
    title: session.plan.title,
    priority: session.plan.priority,
    started_at: session.startedAt,
    finished_at: session.finishedAt ?? '',
    duration_min: session.finishedAt ? Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000) : '',
    exported_at: new Date().toISOString()
  }]

  const exerciseRows = session.plan.exercises.map((exercise) => ({
    order: exercise.order,
    original_exercise_id: exercise.originalExerciseId,
    original_name: exercise.originalName,
    actual_exercise_id: exercise.exerciseId,
    actual_name: exercise.name,
    category: exercise.category,
    muscle_group: exercise.muscleGroup,
    movement_pattern: exercise.movementPattern,
    equipment: exercise.equipment,
    rehab: exercise.rehab ? 'yes' : 'no',
    per_side: exercise.perSide ?? '',
    replaced: exercise.exerciseId !== exercise.originalExerciseId ? 'yes' : 'no',
    replacement_reason: exercise.replacementReason ?? '',
    instruction: exercise.instruction
  }))

  const setRows = session.plan.exercises.flatMap((exercise) => exercise.sets.map((set) => ({
    order: exercise.order,
    original_exercise_id: exercise.originalExerciseId,
    original_name: exercise.originalName,
    actual_exercise_id: exercise.exerciseId,
    actual_name: exercise.name,
    replacement_reason: exercise.replacementReason ?? '',
    set_no: set.setNo,
    set_type: setTypeLabel(set.setType),
    target_weight: set.targetWeight,
    target_reps: set.targetReps,
    target_rir: set.targetRir,
    actual_weight: set.actualWeight,
    actual_reps: set.actualReps,
    actual_rir: set.actualRir,
    pain_0_10: set.pain,
    completed: set.completed ? 'yes' : 'no',
    completed_at: set.completedAt ?? '',
    comment: set.comment
  })))

  const completedSets = setRows.filter((x) => x.completed === 'yes').length
  const replacements = exerciseRows.filter((x) => x.replaced === 'yes').length
  const summaryRows = [
    { metric: 'Упражнений', value: exerciseRows.length },
    { metric: 'Подходов выполнено', value: completedSets },
    { metric: 'Подходов всего', value: setRows.length },
    { metric: 'Замен упражнений', value: replacements }
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workoutRows), 'Workout')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exerciseRows), 'Exercises')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setRows), 'Sets')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary')

  const date = new Date(session.startedAt).toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${session.plan.title.replace(/[^a-zа-я0-9]+/gi, '_')}_${date}_result.xlsx`)
}

export function downloadTemplate() {
  const plan = DEMO_PLAN
  const workoutRows = [{ workout_id: plan.workoutId, title: plan.title, priority: plan.priority, notes: plan.notes }]
  const exerciseRows = plan.exercises.map((exercise) => ({
    exercise_id: exercise.exerciseId,
    order: exercise.order,
    category: exercise.category,
    name: exercise.name,
    muscle_group: exercise.muscleGroup,
    movement_pattern: exercise.movementPattern,
    equipment: exercise.equipment,
    rehab: exercise.rehab ? 'yes' : 'no',
    per_side: exercise.perSide ?? '',
    badge: exercise.badge ?? '',
    instruction: exercise.instruction,
    image: exercise.image ?? ''
  }))
  const setRows = plan.exercises.flatMap((exercise) => exercise.sets.map((set) => ({
    exercise_id: exercise.exerciseId,
    set_no: set.setNo,
    set_type: set.setType,
    target_weight: set.targetWeight,
    target_reps: set.targetReps,
    target_rir: set.targetRir,
    rest_sec: set.restSec,
    notes: set.notes ?? ''
  })))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workoutRows), 'Workout')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exerciseRows), 'Exercises')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setRows), 'Sets')
  XLSX.writeFile(wb, 'FitProgress_workout_template.xlsx')
}
