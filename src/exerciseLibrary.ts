import type { ExerciseDefinition, WorkoutExercise } from './types'
import { CURRENT_GYM_EXERCISES } from './userExercisesCurrent'
import { OLD_GYM_EXERCISES } from './userExercisesOld'
import { REHAB_AND_AUX_EXERCISES } from './userExercisesRehab'

const FUTURE_OR_UNTESTED_EXERCISES: ExerciseDefinition[] = [
  { id:'barbell_rdl', name:'Румынская тяга со штангой', category:'ЗАДНЯЯ ЦЕПЬ', muscleGroup:'Задняя цепь', movementPattern:'Hip hinge', equipment:'Штанга', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–10', icon:'RDL' },
  { id:'db_rdl', name:'Румынская тяга с гантелями', category:'ЗАДНЯЯ ЦЕПЬ', muscleGroup:'Задняя цепь', movementPattern:'Hip hinge', equipment:'Гантели', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–12', icon:'RDL' },
  { id:'cable_pull_through', name:'Cable Pull Through', category:'ЗАДНЯЯ ЦЕПЬ', muscleGroup:'Задняя цепь', movementPattern:'Hip hinge', equipment:'Кроссовер', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'10–15', icon:'HIP' },
  { id:'back_extension_45', name:'Гиперэкстензия 45°', category:'ЗАДНЯЯ ЦЕПЬ', muscleGroup:'Задняя цепь', movementPattern:'Hip hinge', equipment:'Скамья', known:false, suitability:'known', defaultSets:2, defaultReps:'10–15', icon:'45°' },
  { id:'reverse_grip_barbell_row', name:'Тяга штанги к поясу обратным хватом', category:'СПИНА', muscleGroup:'Спина', movementPattern:'Горизонтальная тяга', equipment:'Штанга', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–12', icon:'ROW' },
  { id:'one_arm_cable_row', perSide:'arm', name:'One-Arm Cable Row', category:'СПИНА', muscleGroup:'Спина', movementPattern:'Горизонтальная тяга', equipment:'Кроссовер', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–12', icon:'ROW' },
  { id:'chest_supported_db_row', name:'Chest-Supported DB Row', category:'СПИНА', muscleGroup:'Спина', movementPattern:'Горизонтальная тяга', equipment:'Гантели', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–12', icon:'ROW' },
  { id:'db_shrug', name:'Шраги с гантелями', category:'ТРАПЕЦИИ', muscleGroup:'Трапеции', movementPattern:'Элевация лопатки', equipment:'Гантели', weightUnit:'kg', known:true, suitability:'known', defaultSets:2, defaultReps:'12–15', warmupKnown:'37,5 кг ×12 (старый зал)', lastKnown:'40 кг ×13 (старый зал)', bestKnown:'42,5 кг ×12 (старый зал)', aliases:['Шраги','Шраги с гантелями'], icon:'SHR' },
  { id:'machine_shrug', name:'Machine Shrug', category:'ТРАПЕЦИИ', muscleGroup:'Трапеции', movementPattern:'Элевация лопатки', equipment:'Тренажёр', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'10–15', icon:'SHR' },
  { id:'hack_squat', name:'Hack Squat', category:'КВАДРИЦЕПС', muscleGroup:'Квадрицепс', movementPattern:'Присед', equipment:'Тренажёр', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'8–12', icon:'HS' },
  { id:'medium_lever_cable_fly', perSide:'arm', name:'Medium-Lever Cable Fly', category:'ГРУДЬ / REHAB', muscleGroup:'Грудь', movementPattern:'Горизонтальное приведение', equipment:'Кроссовер', weightUnit:'kg', rehab:true, known:false, suitability:'caution', defaultSets:2, defaultReps:'10–12', historyNote:'Новая ступень после успешно возвращённого short-lever варианта; прогрессировать рычаг/ROM отдельно от веса.', icon:'FLY' },
  { id:'cable_curl', name:'Cable Curl', category:'БИЦЕПС', muscleGroup:'Бицепс', movementPattern:'Сгибание локтя', equipment:'Кроссовер', weightUnit:'kg', known:false, suitability:'known', defaultSets:2, defaultReps:'10–15', icon:'BI' },
  { id:'overhead_cable_extension', name:'Overhead Cable Extension', category:'ТРИЦЕПС', muscleGroup:'Трицепс', movementPattern:'Разгибание локтя', equipment:'Кроссовер', weightUnit:'kg', known:true, suitability:'known', defaultSets:2, defaultReps:'10–15', bestKnown:'59 кг ×13 (старый зал)', icon:'TRI' }
]

function dedupe(list: ExerciseDefinition[]) {
  const map = new Map<string, ExerciseDefinition>()
  for (const item of list) if (!map.has(item.id)) map.set(item.id, item)
  return [...map.values()]
}

export const EXERCISE_LIBRARY: ExerciseDefinition[] = dedupe([
  ...CURRENT_GYM_EXERCISES,
  ...REHAB_AND_AUX_EXERCISES,
  ...OLD_GYM_EXERCISES,
  ...FUTURE_OR_UNTESTED_EXERCISES
])

const normalize = (value: string) =>
  value.toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const getDefinition = (id: string) => EXERCISE_LIBRARY.find((x) => x.id === id)

export function findDefinition(idOrName: string, name?: string) {
  const direct = getDefinition(idOrName)
  if (direct) return direct
  const needles = [idOrName, name].filter(Boolean).map((x) => normalize(String(x)))
  return EXERCISE_LIBRARY.find((exercise) => {
    const candidates = [exercise.name, ...(exercise.aliases ?? [])].map(normalize)
    return needles.some((needle) => candidates.includes(needle))
  })
}

export function replacementCandidates(exercise: WorkoutExercise) {
  return EXERCISE_LIBRARY
    .filter((x) => x.id !== exercise.exerciseId && x.suitability !== 'avoid')
    .map((x) => {
      let score = 0
      if (x.muscleGroup === exercise.muscleGroup) score += 6
      if (x.movementPattern === exercise.movementPattern) score += 8
      if (x.equipment !== exercise.equipment) score += 1
      if (exercise.rehab && x.rehab) score += 3
      if (!exercise.rehab && x.rehab) score -= 2
      if (x.known) score += 3
      if (x.gym === 'Новый зал') score += 2
      if (x.suitability === 'caution') score -= 3
      return { ...x, score }
    })
    .filter((x) => x.score >= 6)
    .sort((a, b) => b.score - a.score || Number(Boolean(b.known)) - Number(Boolean(a.known)) || a.name.localeCompare(b.name, 'ru'))
}
