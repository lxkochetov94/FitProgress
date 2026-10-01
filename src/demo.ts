import type { WorkoutExercise, WorkoutPlan, WorkoutSet } from './types'

const set = (
  id: string,
  setNo: number,
  setType: WorkoutSet['setType'],
  targetWeight: string,
  targetReps: string,
  targetRir: string,
  restSec: number,
  notes = ''
): WorkoutSet => ({
  id,
  setNo,
  setType,
  targetWeight,
  targetReps,
  targetRir,
  restSec,
  notes,
  actualWeight: targetWeight,
  actualReps: targetReps,
  actualRir: '',
  pain: '',
  comment: '',
  completed: false
})

const ex = (data: Omit<WorkoutExercise, 'instanceId' | 'originalExerciseId' | 'originalName'>): WorkoutExercise => ({
  ...data,
  instanceId: `${data.exerciseId}-${data.order}`,
  originalExerciseId: data.exerciseId,
  originalName: data.name,
  restAfterExerciseSec: data.restAfterExerciseSec ?? Math.max(90, data.sets[data.sets.length - 1]?.restSec ?? 90)
})

export const DEMO_PLAN: WorkoutPlan = {
  workoutId: 'full-body-k-demo',
  title: 'FULL BODY K',
  priority: 'Задняя мышечная цепь, толщина спины, трапеции, гипертрофия и специфическая реабилитация плеча.',
  notes: 'Демо собрано по программе FULL BODY K. Используй его, чтобы проверить интерфейс до первого импорта Excel.',
  exercises: [
    ex({ exerciseId: 'cable_er_75_90', order: 1, category: 'REHAB / РАЗМИНКА', name: 'Cable ER @75–90°', muscleGroup: 'Плечо', perSide: 'arm', movementPattern: 'Наружная ротация', equipment: 'Кроссовер', rehab: true, badge: 'Разминка', instruction: '6,8 кг ×10 ×1, RIR 3–4. Темп 2–1–2. Если дискомфорт ≤1/10, больше ER не выполняем.', sets: [set('1-1', 1, 'rehab', '6,8', '10', '3–4', 60)] }),
    ex({ exerciseId: 'barbell_rdl', order: 2, category: 'ПРИОРИТЕТ №1', name: 'Румынская тяга со штангой', muscleGroup: 'Задняя цепь', movementPattern: 'Hip hinge', equipment: 'Штанга', rehab: false, instruction: '20 кг ×10 — освоить движение. 40 кг ×8 — калибровка. Если легко и техника стабильная: 50–60 кг ×8–10 ×2, RIR 3–4. Сохраняй нейтральное положение позвоночника.', sets: [set('2-1', 1, 'warmup', '20', '10', '', 90), set('2-2', 2, 'calibration', '40', '8', '', 120), set('2-3', 3, 'working', '50–60', '8–10', '3–4', 120), set('2-4', 4, 'working', '50–60', '8–10', '3–4', 120)] }),
    ex({ exerciseId: 'reverse_grip_barbell_row', order: 3, category: 'СПИНА', name: 'Тяга штанги к поясу обратным хватом', muscleGroup: 'Спина', movementPattern: 'Горизонтальная тяга', equipment: 'Штанга', rehab: false, instruction: '20 кг ×10, затем 30–40 кг ×6–8 — калибровка. 2×8–12, RIR 2–3. Тяни к нижней части живота, корпус стабилен.', sets: [set('3-1', 1, 'warmup', '20', '10', '', 90), set('3-2', 2, 'calibration', '30–40', '6–8', '', 120), set('3-3', 3, 'working', '30–40', '8–12', '2–3', 120), set('3-4', 4, 'working', '30–40', '8–12', '2–3', 120)] }),
    ex({ exerciseId: 'db_shrug', order: 4, category: 'ТРАПЕЦИИ', name: 'Шраги с гантелями', muscleGroup: 'Трапеции', movementPattern: 'Элевация лопатки', equipment: 'Гантели', rehab: false, instruction: '14–16 кг в каждой руке ×12 — подготовка. Затем 2×12–15, RIR 2–3. В верхней точке удержание 1–2 секунды, опускание 2–3 секунды.', sets: [set('4-1', 1, 'warmup', '14–16', '12', '', 75), set('4-2', 2, 'working', '14–16', '12–15', '2–3', 90), set('4-3', 3, 'working', '14–16', '12–15', '2–3', 90)] }),
    ex({ exerciseId: 'matrix_leg_extension', order: 5, category: 'КВАДРИЦЕПС', name: 'Matrix Leg Extension', muscleGroup: 'Квадрицепс', weightUnit: 'lb', movementPattern: 'Разгибание колена', equipment: 'Matrix', rehab: false, instruction: '160 lb ×6 — разминка. 200 lb ×12–15 ×2, RIR 1–2. Квадрицепс получает целевую работу без лишней системной усталости.', sets: [set('5-1', 1, 'warmup', '160', '6', '', 90), set('5-2', 2, 'working', '200', '12–15', '1–2', 120), set('5-3', 3, 'working', '200', '12–15', '1–2', 120)] }),
    ex({ exerciseId: 'cable_internal_rotation', order: 6, category: 'REHAB / ПРИОРИТЕТ', name: 'Cable Internal Rotation', muscleGroup: 'Плечо', perSide: 'arm', movementPattern: 'Внутренняя ротация', equipment: 'Кроссовер', rehab: true, instruction: '6,8 кг ×8–10 — подготовка. 9 кг ×8–10 ×2, RIR 3–4. Начинай почти из полной активной комфортной наружной ротации.', sets: [set('6-1', 1, 'rehab', '6,8', '8–10', '', 60), set('6-2', 2, 'rehab', '9', '8–10', '3–4', 75), set('6-3', 3, 'rehab', '9', '8–10', '3–4', 75)] }),
    ex({ exerciseId: 'incline_db_press', order: 7, category: 'REHAB / ЖИМ', name: 'Incline DB Press · Bottom-start', muscleGroup: 'Грудь', movementPattern: 'Наклонный жим', equipment: 'Гантели', rehab: true, instruction: '16 кг ×6 — подготовка. 24 кг ×6 — контроль нижнего старта. При спокойном плече 26 кг ×6–8 ×1–2, RIR ≥4; если следующая ступень сразу 28 кг — 24 кг ×8–10 ×2.', sets: [set('7-1', 1, 'warmup', '16', '6', '', 120), set('7-2', 2, 'calibration', '24', '6', '≥4', 150), set('7-3', 3, 'working', '26', '6–8', '≥4', 150), set('7-4', 4, 'working', '26', '6–8', '≥4', 150)] }),
    ex({ exerciseId: 'medium_lever_cable_fly', order: 8, category: 'REHAB / ГОРИЗОНТАЛЬНОЕ ПРИВЕДЕНИЕ', name: 'Medium-lever Cable Fly', muscleGroup: 'Грудь', perSide: 'arm', movementPattern: 'Горизонтальное приведение', equipment: 'Кроссовер', rehab: true, instruction: '9 кг ×10 — подготовка. 9 кг ×10–12 ×2, RIR 3–4. Локоть согнут примерно на 45–60°. Сегодня вес не повышаем.', sets: [set('8-1', 1, 'rehab', '9', '10', '', 75), set('8-2', 2, 'rehab', '9', '10–12', '3–4', 90), set('8-3', 3, 'rehab', '9', '10–12', '3–4', 90)] }),
    ex({ exerciseId: 'one_arm_db_preacher', order: 9, category: 'БИЦЕПС', name: 'One-Arm DB Preacher Curl', muscleGroup: 'Бицепс', perSide: 'arm', movementPattern: 'Сгибание локтя', equipment: 'Гантель', rehab: false, instruction: '10 кг ×8 — разминка. 14 кг ×8–12 ×2, RIR 1–2. Закрепляем вес в двух полноценных рабочих подходах.', sets: [set('9-1', 1, 'warmup', '10', '8', '', 60), set('9-2', 2, 'working', '14', '8–12', '1–2', 90), set('9-3', 3, 'working', '14', '8–12', '1–2', 90)] }),
    ex({ exerciseId: 'one_arm_cable_pushdown', order: 10, category: 'ТРИЦЕПС', name: 'One-Arm Cable Pushdown', muscleGroup: 'Трицепс', perSide: 'arm', movementPattern: 'Разгибание локтя', equipment: 'Кроссовер', rehab: false, instruction: '11,3 кг ×10–12 на каждую руку ×2, RIR 1–2. Если оба подхода уверенные, на следующей экспозиции можно рассмотреть увеличение нагрузки.', sets: [set('10-1', 1, 'working', '11,3', '10–12', '1–2', 75), set('10-2', 2, 'working', '11,3', '10–12', '1–2', 75)] })
  ]
}
