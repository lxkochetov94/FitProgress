import * as XLSX from 'xlsx'
import type { PerSide, WeightUnit, WorkoutExercise, WorkoutPlan, WorkoutSession, WorkoutSet } from './types'
import { findDefinition } from './exerciseLibrary'
import { DEMO_PLAN } from './demo'
import { loadHistory } from './storage'
import { RETRO_JUN } from './analyticsSeedJun'
import { RETRO_JUL } from './analyticsSeedJul'
import { RETRO_AUG } from './analyticsSeedAug'
import { RETRO_SEP } from './analyticsSeedSep'

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

const detectWeightUnit = (value: unknown): WeightUnit | undefined => {
  const text = str(value).toLowerCase()
  if (/\b(lb|lbs|pound|pounds)\b/.test(text)) return 'lb'
  if (/\b(kg|кг|килограмм)/.test(text)) return 'kg'
  return undefined
}

const stripWeightUnit = (value: string) =>
  value.replace(/\s*(?:kg|кг|lbs?|pounds?)\b/gi, '').trim()

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
      const sourceExerciseId = str(rowValue(row, 'exercise_id', 'id')) || `exercise_${index + 1}`
      const importedName = str(rowValue(row, 'name', 'exercise_name', 'упражнение'))
      const def = findDefinition(sourceExerciseId, importedName)
      const exerciseId = def?.id || sourceExerciseId
      const name = importedName || def?.name || sourceExerciseId
      const rawSets = setRows
        .filter((setRow) => str(rowValue(setRow, 'exercise_id', 'id')) === sourceExerciseId)
        .map((setRow, setIndex) => newSet(exerciseId, setRow, setIndex))
        .sort((a, b) => a.setNo - b.setNo)
      const perSide =
        detectPerSide(rowValue(row, 'per_side', 'per_side_label', 'на_сторону')) ||
        rawSets.map((set) => detectPerSide(set.targetReps)).find(Boolean) ||
        def?.perSide
      const weightUnit =
        detectWeightUnit(rowValue(row, 'weight_unit', 'unit', 'единица_веса')) ||
        rawSets.map((set) => detectWeightUnit(set.targetWeight)).find(Boolean) ||
        def?.weightUnit ||
        'kg'
      const setsForExercise = rawSets.map((set) => ({
        ...set,
        targetWeight: stripWeightUnit(set.targetWeight),
        actualWeight: stripWeightUnit(set.actualWeight),
        targetReps: perSide ? stripPerSideSuffix(set.targetReps) : set.targetReps,
        actualReps: perSide ? stripPerSideSuffix(set.actualReps) : set.actualReps
      }))

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
        weightUnit,
        restAfterExerciseSec: num(
          rowValue(row, 'rest_after_exercise_sec', 'rest_between_exercises_sec', 'exercise_rest_sec', 'отдых_между_упражнениями_сек'),
          Math.max(90, setsForExercise[setsForExercise.length - 1]?.restSec ?? 90)
        ),
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
    finish_mode: session.finishMode ?? '',
    finish_reason: session.finishReason ?? '',
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
    weight_unit: exercise.weightUnit ?? 'kg',
    replaced: exercise.exerciseId !== exercise.originalExerciseId ? 'yes' : 'no',
    replacement_reason: exercise.replacementReason ?? '',
    rest_after_exercise_sec: exercise.restAfterExerciseSec ?? '',
    exercise_status: exercise.finishMode ?? (exercise.finishedAt ? 'completed' : 'open'),
    finish_reason: exercise.finishReason ?? '',
    started_at: exercise.startedAt ?? '',
    finished_at: exercise.finishedAt ?? '',
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
    rest_sec: set.restSec,
    is_extra: set.isExtra ? 'yes' : 'no',
    copied_from_set_no: set.copiedFromSetNo ?? '',
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


const RETRO_REGISTRY = [...RETRO_JUN, ...RETRO_JUL, ...RETRO_AUG, ...RETRO_SEP]

const retroSetType = (label: string, intensity: string) => {
  const text = `${label} ${intensity}`.toLowerCase()
  if (/размин|подвод|подгот/.test(text)) return 'Разминка / подготовка'
  if (/калибр/.test(text)) return 'Калибровка'
  if (/rehab|реабил/.test(text)) return 'Rehab'
  if (/проб|тест|экспоз|maintenance|контрол/.test(text)) return 'Проба / контроль'
  return 'Рабочий / фактический'
}

const registryColumns = [
  { key: 'workout_no', width: 11 },
  { key: 'source', width: 14 },
  { key: 'date', width: 14 },
  { key: 'period', width: 17 },
  { key: 'gym', width: 16 },
  { key: 'workout_title', width: 46 },
  { key: 'workout_id', width: 30 },
  { key: 'session_id', width: 38 },
  { key: 'exercise_order', width: 13 },
  { key: 'original_exercise_id', width: 30 },
  { key: 'original_name', width: 34 },
  { key: 'exercise_id', width: 30 },
  { key: 'exercise_name', width: 38 },
  { key: 'category', width: 24 },
  { key: 'muscle_group', width: 24 },
  { key: 'equipment', width: 24 },
  { key: 'rehab', width: 10 },
  { key: 'per_side', width: 11 },
  { key: 'weight_unit', width: 12 },
  { key: 'set_no', width: 10 },
  { key: 'set_label', width: 23 },
  { key: 'set_type', width: 23 },
  { key: 'target_weight', width: 18 },
  { key: 'target_reps', width: 18 },
  { key: 'target_rir', width: 14 },
  { key: 'actual_weight', width: 18 },
  { key: 'actual_reps', width: 18 },
  { key: 'actual_rir_or_intensity', width: 24 },
  { key: 'pain_0_10', width: 12 },
  { key: 'completed', width: 12 },
  { key: 'completed_at', width: 24 },
  { key: 'rest_sec', width: 12 },
  { key: 'is_extra', width: 11 },
  { key: 'replacement_reason', width: 22 },
  { key: 'comment', width: 60 }
] as const

function registrySheet(rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: registryColumns.map((x) => x.key) as string[] })
  sheet['!cols'] = registryColumns.map((x) => ({ wch: x.width }))
  if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] }
  return sheet
}

export function exportFullRegistry() {
  const localHistory = loadHistory()
    .filter((session) => Boolean(session.finishedAt))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const registryRows: Record<string, unknown>[] = []
  const workoutRows: Record<string, unknown>[] = []

  for (const tuple of RETRO_REGISTRY) {
    const [id, order, date, periodKey, periodLabel, gym, title, exercises] = tuple
    const completedSets = exercises.reduce((sum, exercise) => sum + exercise[2].length, 0)

    workoutRows.push({
      workout_no: order,
      source: 'Ретроспектива',
      date: date ?? '',
      period: periodLabel || periodKey,
      gym,
      workout_title: title,
      workout_id: id,
      session_id: '',
      started_at: '',
      finished_at: '',
      duration_min: '',
      finish_mode: '',
      finish_reason: '',
      exercises: exercises.length,
      completed_sets: completedSets
    })

    exercises.forEach(([exerciseId, exerciseName, sets], exerciseIndex) => {
      const def = findDefinition(exerciseId, exerciseName)
      sets.forEach(([label, weight, reps, intensity], setIndex) => {
        registryRows.push({
          workout_no: order,
          source: 'Ретроспектива',
          date: date ?? '',
          period: periodLabel || periodKey,
          gym,
          workout_title: title,
          workout_id: id,
          session_id: '',
          exercise_order: exerciseIndex + 1,
          original_exercise_id: exerciseId,
          original_name: exerciseName,
          exercise_id: def?.id ?? exerciseId,
          exercise_name: def?.name ?? exerciseName,
          category: def?.category ?? '',
          muscle_group: def?.muscleGroup ?? '',
          equipment: def?.equipment ?? '',
          rehab: def?.rehab ? 'yes' : 'no',
          per_side: def?.perSide ?? '',
          weight_unit: def?.weightUnit ?? detectWeightUnit(weight) ?? '',
          set_no: setIndex + 1,
          set_label: label,
          set_type: retroSetType(label, intensity),
          target_weight: '',
          target_reps: '',
          target_rir: '',
          actual_weight: weight,
          actual_reps: reps,
          actual_rir_or_intensity: intensity,
          pain_0_10: '',
          completed: 'yes',
          completed_at: '',
          rest_sec: '',
          is_extra: '',
          replacement_reason: '',
          comment: ''
        })
      })
    })
  }

  localHistory.forEach((session, localIndex) => {
    const workoutNo = RETRO_REGISTRY.length + localIndex + 1
    const date = session.startedAt.slice(0, 10)
    const durationMin = session.finishedAt
      ? Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000)
      : ''
    const completedSets = session.plan.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
      0
    )

    workoutRows.push({
      workout_no: workoutNo,
      source: 'FitProgress',
      date,
      period: date.slice(0, 7),
      gym: 'Новый зал',
      workout_title: session.plan.title,
      workout_id: session.plan.workoutId,
      session_id: session.sessionId,
      started_at: session.startedAt,
      finished_at: session.finishedAt ?? '',
      duration_min: durationMin,
      finish_mode: session.finishMode ?? '',
      finish_reason: session.finishReason ?? '',
      exercises: session.plan.exercises.length,
      completed_sets: completedSets
    })

    session.plan.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        registryRows.push({
          workout_no: workoutNo,
          source: 'FitProgress',
          date,
          period: date.slice(0, 7),
          gym: 'Новый зал',
          workout_title: session.plan.title,
          workout_id: session.plan.workoutId,
          session_id: session.sessionId,
          exercise_order: exercise.order,
          original_exercise_id: exercise.originalExerciseId,
          original_name: exercise.originalName,
          exercise_id: exercise.exerciseId,
          exercise_name: exercise.name,
          category: exercise.category,
          muscle_group: exercise.muscleGroup,
          equipment: exercise.equipment,
          rehab: exercise.rehab ? 'yes' : 'no',
          per_side: exercise.perSide ?? '',
          weight_unit: exercise.weightUnit ?? 'kg',
          set_no: set.setNo,
          set_label: localSetLabelForRegistry(set),
          set_type: setTypeLabel(set.setType),
          target_weight: set.targetWeight,
          target_reps: set.targetReps,
          target_rir: set.targetRir,
          actual_weight: set.actualWeight,
          actual_reps: set.actualReps,
          actual_rir_or_intensity: set.actualRir,
          pain_0_10: set.pain,
          completed: set.completed ? 'yes' : 'no',
          completed_at: set.completedAt ?? '',
          rest_sec: set.restSec,
          is_extra: set.isExtra ? 'yes' : 'no',
          replacement_reason: exercise.replacementReason ?? '',
          comment: set.comment
        })
      })
    })
  })

  const wb = XLSX.utils.book_new()

  const readme = XLSX.utils.aoa_to_sheet([
    ['FitProgress · полный реестр тренировок'],
    [],
    ['Назначение', 'Единый накопительный файл для анализа всей тренировочной истории и подготовки следующих тренировок.'],
    ['Состав', `${RETRO_REGISTRY.length} встроенных ретроспективных тренировок + ${localHistory.length} завершённых тренировок FitProgress.`],
    ['Registry', 'Одна строка = один подход. Это основной лист для машинного и ручного анализа.'],
    ['Workouts', 'Одна строка = одна тренировка с метаданными и количеством упражнений/подходов.'],
    ['Даты старой истории', 'Если точный день отсутствовал в исходной ревизии, приложение сохраняет период как есть и НЕ придумывает дату.'],
    ['Новые тренировки', 'После завершения тренировки FitProgress автоматически добавляет её в локальную историю; следующий полный экспорт уже включает её.'],
    ['Важно', 'Не удаляй этот файл из приложения вручную: это экспорт/резервная копия. Источник новых тренировок остаётся в локальном хранилище FitProgress.'],
    [],
    ['Экспортировано', new Date().toISOString()]
  ])
  readme['!cols'] = [{ wch: 28 }, { wch: 100 }]
  XLSX.utils.book_append_sheet(wb, readme, 'README')

  const workoutsSheet = XLSX.utils.json_to_sheet(workoutRows)
  workoutsSheet['!cols'] = [
    { wch: 11 }, { wch: 15 }, { wch: 14 }, { wch: 17 }, { wch: 16 }, { wch: 48 },
    { wch: 30 }, { wch: 38 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 18 },
    { wch: 12 }, { wch: 16 }
  ]
  if (workoutsSheet['!ref']) workoutsSheet['!autofilter'] = { ref: workoutsSheet['!ref'] }
  XLSX.utils.book_append_sheet(wb, workoutsSheet, 'Workouts')

  XLSX.utils.book_append_sheet(wb, registrySheet(registryRows), 'Registry')

  const latestDate = localHistory.at(-1)?.startedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `FitProgress_FULL_REGISTRY_${latestDate}.xlsx`)
}

function localSetLabelForRegistry(set: WorkoutSet) {
  if (set.isExtra) return `Доп. сет ${set.setNo}`
  if (set.setType === 'warmup') return 'Разминка'
  if (set.setType === 'calibration') return 'Калибровка'
  if (set.setType === 'rehab') return `Rehab ${set.setNo}`
  return String(set.setNo)
}

export function downloadTemplate() {
  const wb = XLSX.utils.book_new()

  const readmeRows = [
    ['FitProgress · стандартный шаблон тренировки v1'],
    [],
    ['Правило', 'Что делать', 'Пример'],
    ['Workout', 'Одна строка с метаданными тренировки.', 'FULL BODY K'],
    ['exercise_id', 'Одинаковый ID в Exercises и Sets. Для знакомых упражнений используем ID базы FitProgress.', 'barbell_rdl'],
    ['Вес', 'target_weight без кг/lbs. Единица задаётся через weight_unit.', '50–60'],
    ['Повторы', 'target_reps без /руку или /ногу. Односторонность задаётся через per_side.', '8–10'],
    ['per_side', 'arm / leg / side; для двусторонних оставить пустым.', 'arm'],
    ['Отдых между подходами', 'Sets → rest_sec, секунды.', '90'],
    ['Отдых между упражнениями', 'Exercises → rest_after_exercise_sec, секунды.', '120'],
    ['set_type', 'warmup / calibration / working / rehab / other.', 'working'],
    ['RIR', 'target_rir — число или диапазон.', '1–2'],
    ['Инструкции', 'Техника, темп, ограничения по боли — instruction; частные подсказки — notes.', 'Темп 2–1–2; боль ≤1/10'],
    [],
    ['Важно', 'Названия листов Workout / Exercises / Sets и канонические названия колонок лучше не менять.']
  ]
  const readme = XLSX.utils.aoa_to_sheet(readmeRows)
  readme['!cols'] = [{ wch: 24 }, { wch: 72 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, readme, 'README')

  const workoutHeaders = ['schema_version', 'workout_id', 'title', 'priority', 'notes']
  const workout = XLSX.utils.aoa_to_sheet([
    workoutHeaders,
    ['fitprogress-v1', '', '', '', '']
  ])
  workout['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 48 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, workout, 'Workout')

  const exerciseHeaders = [
    'exercise_id', 'order', 'category', 'name', 'muscle_group', 'movement_pattern',
    'equipment', 'rehab', 'per_side', 'weight_unit', 'rest_after_exercise_sec',
    'badge', 'instruction', 'image'
  ]
  const exercises = XLSX.utils.aoa_to_sheet([exerciseHeaders])
  exercises['!cols'] = [
    { wch: 28 }, { wch: 9 }, { wch: 22 }, { wch: 36 }, { wch: 24 }, { wch: 28 },
    { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
    { wch: 18 }, { wch: 70 }, { wch: 34 }
  ]
  XLSX.utils.book_append_sheet(wb, exercises, 'Exercises')

  const setHeaders = [
    'exercise_id', 'set_no', 'set_type', 'target_weight',
    'target_reps', 'target_rir', 'rest_sec', 'notes'
  ]
  const sets = XLSX.utils.aoa_to_sheet([setHeaders])
  sets['!cols'] = [
    { wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 64 }
  ]
  XLSX.utils.book_append_sheet(wb, sets, 'Sets')

  const dictionaries = XLSX.utils.aoa_to_sheet([
    ['set_type', 'per_side', 'weight_unit', 'rehab'],
    ['warmup', 'arm', 'kg', 'yes'],
    ['calibration', 'leg', 'lb', 'no'],
    ['working', 'side', '', 'да'],
    ['rehab', '', '', 'нет'],
    ['other', '', '', '']
  ])
  dictionaries['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, dictionaries, 'Dictionaries')

  const example = XLSX.utils.aoa_to_sheet([
    ['Пример заполнения · этот лист не импортируется приложением'],
    [],
    exerciseHeaders,
    ['cable_er_75_90', 1, 'REHAB / РАЗМИНКА', 'Cable ER @75–90°', 'Плечо', 'Наружная ротация', 'Кроссовер', 'yes', 'arm', 'kg', 90, 'Разминка', '6,8 кг ×10; темп 2–1–2; если дискомфорт >1/10 — остановить.', ''],
    ['barbell_rdl', 2, 'ПРИОРИТЕТ №1', 'Румынская тяга со штангой', 'Задняя цепь', 'Hip hinge', 'Штанга', 'no', '', 'kg', 120, '', 'Нейтральный позвоночник; рабочая амплитуда без потери контроля таза.', ''],
    [],
    setHeaders,
    ['cable_er_75_90', 1, 'rehab', '6,8', '10', '3–4', 90, 'На каждую руку; боль ≤1/10'],
    ['barbell_rdl', 1, 'warmup', '20', '10', '', 90, 'Освоить движение'],
    ['barbell_rdl', 2, 'calibration', '40', '8', '', 120, 'Калибровка'],
    ['barbell_rdl', 3, 'working', '50–60', '8–10', '3–4', 120, ''],
    ['barbell_rdl', 4, 'working', '50–60', '8–10', '3–4', 120, '']
  ])
  example['!cols'] = exercises['!cols']
  XLSX.utils.book_append_sheet(wb, example, 'Example')

  XLSX.writeFile(wb, 'FitProgress_workout_template_v1.xlsx')
}
