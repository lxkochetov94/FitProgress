import type { ExerciseDefinition, WorkoutExercise } from './types'

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  { id: 'cable_er_75_90', perSide: 'arm', name: 'Cable ER @75–90°', category: 'REHAB / РАЗМИНКА', muscleGroup: 'Плечо', movementPattern: 'Наружная ротация', equipment: 'Кроссовер', rehab: true, defaultSets: 1, defaultReps: '10/руку', icon: 'ER' },
  { id: 'barbell_rdl', name: 'Румынская тяга со штангой', category: 'ЗАДНЯЯ ЦЕПЬ', muscleGroup: 'Задняя цепь', movementPattern: 'Hip hinge', equipment: 'Штанга', defaultSets: 2, defaultReps: '8–10', icon: 'RDL' },
  { id: 'db_rdl', name: 'Румынская тяга с гантелями', category: 'ЗАДНЯЯ ЦЕПЬ', muscleGroup: 'Задняя цепь', movementPattern: 'Hip hinge', equipment: 'Гантели', defaultSets: 2, defaultReps: '8–12', icon: 'RDL' },
  { id: 'cable_pull_through', name: 'Cable Pull Through', category: 'ЗАДНЯЯ ЦЕПЬ', muscleGroup: 'Задняя цепь', movementPattern: 'Hip hinge', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '10–15', icon: 'HIP' },
  { id: 'back_extension_45', name: 'Гиперэкстензия 45°', category: 'ЗАДНЯЯ ЦЕПЬ', muscleGroup: 'Задняя цепь', movementPattern: 'Hip hinge', equipment: 'Скамья', defaultSets: 2, defaultReps: '10–15', icon: '45°' },
  { id: 'seated_leg_curl', name: 'Seated Leg Curl', category: 'БИЦЕПС БЕДРА', muscleGroup: 'Задняя цепь', movementPattern: 'Сгибание колена', equipment: 'Тренажёр', defaultSets: 2, defaultReps: '10–15', icon: 'LC' },
  { id: 'reverse_grip_barbell_row', name: 'Тяга штанги к поясу обратным хватом', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Горизонтальная тяга', equipment: 'Штанга', defaultSets: 2, defaultReps: '8–12', icon: 'ROW' },
  { id: 'matrix_seated_row', name: 'Matrix Seated Row', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Горизонтальная тяга', equipment: 'Matrix', defaultSets: 2, defaultReps: '8–12', icon: 'ROW' },
  { id: 'one_arm_cable_row', perSide: 'arm', name: 'One-Arm Cable Row', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Горизонтальная тяга', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '8–12', icon: 'ROW' },
  { id: 'chest_supported_db_row', name: 'Chest-Supported DB Row', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Горизонтальная тяга', equipment: 'Гантели', defaultSets: 2, defaultReps: '8–12', icon: 'ROW' },
  { id: 'neutral_pullup', name: 'Подтягивания нейтральным хватом', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Вертикальная тяга', equipment: 'Турник', defaultSets: 2, defaultReps: '6–12', icon: 'PULL' },
  { id: 'lat_pulldown', name: 'Lat Pulldown', category: 'СПИНА', muscleGroup: 'Спина', movementPattern: 'Вертикальная тяга', equipment: 'Блок', defaultSets: 2, defaultReps: '8–12', icon: 'LAT' },
  { id: 'db_shrug', name: 'Шраги с гантелями', category: 'ТРАПЕЦИИ', muscleGroup: 'Трапеции', movementPattern: 'Элевация лопатки', equipment: 'Гантели', defaultSets: 2, defaultReps: '12–15', icon: 'SHR' },
  { id: 'machine_shrug', name: 'Machine Shrug', category: 'ТРАПЕЦИИ', muscleGroup: 'Трапеции', movementPattern: 'Элевация лопатки', equipment: 'Тренажёр', defaultSets: 2, defaultReps: '10–15', icon: 'SHR' },
  { id: 'matrix_leg_extension', name: 'Matrix Leg Extension', category: 'КВАДРИЦЕПС', muscleGroup: 'Квадрицепс', movementPattern: 'Разгибание колена', equipment: 'Matrix', defaultSets: 2, defaultReps: '12–15', icon: 'LE' },
  { id: 'leg_press', name: 'Matrix Leg Press', category: 'КВАДРИЦЕПС', muscleGroup: 'Квадрицепс', movementPattern: 'Жим ногами', equipment: 'Matrix', defaultSets: 2, defaultReps: '8–15', icon: 'LP' },
  { id: 'hack_squat', name: 'Hack Squat', category: 'КВАДРИЦЕПС', muscleGroup: 'Квадрицепс', movementPattern: 'Присед', equipment: 'Тренажёр', defaultSets: 2, defaultReps: '8–12', icon: 'HS' },
  { id: 'bulgarian_split_squat', perSide: 'leg', name: 'Bulgarian Split Squat', category: 'КВАДРИЦЕПС', muscleGroup: 'Квадрицепс', movementPattern: 'Присед', equipment: 'Гантели', defaultSets: 2, defaultReps: '8–12/ногу', icon: 'BSS' },
  { id: 'walking_lunges', perSide: 'leg', name: 'Walking Lunges', category: 'НОГИ', muscleGroup: 'Квадрицепс', movementPattern: 'Выпад', equipment: 'Гантели', defaultSets: 2, defaultReps: '10–14/ногу', icon: 'LNG' },
  { id: 'cable_internal_rotation', perSide: 'arm', name: 'Cable Internal Rotation', category: 'REHAB / ПРИОРИТЕТ', muscleGroup: 'Плечо', movementPattern: 'Внутренняя ротация', equipment: 'Кроссовер', rehab: true, defaultSets: 2, defaultReps: '8–10/руку', icon: 'IR' },
  { id: 'incline_db_press', name: 'Incline DB Press · Bottom-start', category: 'ГРУДЬ / REHAB', muscleGroup: 'Грудь', movementPattern: 'Наклонный жим', equipment: 'Гантели', rehab: true, defaultSets: 2, defaultReps: '6–10', icon: 'DB' },
  { id: 'matrix_chest_press', name: 'Matrix Chest Press', category: 'ГРУДЬ', muscleGroup: 'Грудь', movementPattern: 'Горизонтальный жим', equipment: 'Matrix', defaultSets: 2, defaultReps: '8–12', icon: 'CP' },
  { id: 'machine_shoulder_press', name: 'Machine Shoulder Press', category: 'ПЛЕЧИ', muscleGroup: 'Плечи', movementPattern: 'Вертикальный жим', equipment: 'Тренажёр', rehab: true, defaultSets: 2, defaultReps: '8–12', icon: 'SP' },
  { id: 'medium_lever_cable_fly', perSide: 'arm', name: 'Medium-lever Cable Fly', category: 'ГРУДЬ / REHAB', muscleGroup: 'Грудь', movementPattern: 'Горизонтальное приведение', equipment: 'Кроссовер', rehab: true, defaultSets: 2, defaultReps: '10–12/руку', icon: 'FLY' },
  { id: 'pec_deck', name: 'Pec Deck', category: 'ГРУДЬ', muscleGroup: 'Грудь', movementPattern: 'Горизонтальное приведение', equipment: 'Тренажёр', defaultSets: 2, defaultReps: '10–15', icon: 'PEC' },
  { id: 'one_arm_db_preacher', perSide: 'arm', name: 'One-Arm DB Preacher Curl', category: 'БИЦЕПС', muscleGroup: 'Бицепс', movementPattern: 'Сгибание локтя', equipment: 'Гантель', defaultSets: 2, defaultReps: '8–12/руку', icon: 'BI' },
  { id: 'ez_preacher_curl', name: 'Scott EZ Curl', category: 'БИЦЕПС', muscleGroup: 'Бицепс', movementPattern: 'Сгибание локтя', equipment: 'EZ-штанга', defaultSets: 2, defaultReps: '8–12', icon: 'EZ' },
  { id: 'cable_curl', name: 'Cable Curl', category: 'БИЦЕПС', muscleGroup: 'Бицепс', movementPattern: 'Сгибание локтя', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '10–15', icon: 'BI' },
  { id: 'one_arm_cable_pushdown', perSide: 'arm', name: 'One-Arm Cable Pushdown', category: 'ТРИЦЕПС', muscleGroup: 'Трицепс', movementPattern: 'Разгибание локтя', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '10–15/руку', icon: 'TRI' },
  { id: 'rope_pushdown', name: 'Rope Pushdown', category: 'ТРИЦЕПС', muscleGroup: 'Трицепс', movementPattern: 'Разгибание локтя', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '10–15', icon: 'TRI' },
  { id: 'overhead_cable_extension', name: 'Overhead Cable Extension', category: 'ТРИЦЕПС', muscleGroup: 'Трицепс', movementPattern: 'Разгибание локтя', equipment: 'Кроссовер', defaultSets: 2, defaultReps: '10–15', icon: 'TRI' }
]

export const getDefinition = (id: string) => EXERCISE_LIBRARY.find((x) => x.id === id)

export function replacementCandidates(exercise: WorkoutExercise) {
  const scored = EXERCISE_LIBRARY
    .filter((x) => x.id !== exercise.exerciseId)
    .map((x) => {
      let score = 0
      if (x.muscleGroup === exercise.muscleGroup) score += 5
      if (x.movementPattern === exercise.movementPattern) score += 7
      if (x.equipment !== exercise.equipment) score += 1
      if (exercise.rehab && x.rehab) score += 2
      return { ...x, score }
    })
    .filter((x) => x.score >= 5)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ru'))

  return scored
}
