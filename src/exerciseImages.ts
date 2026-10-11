import type { ExerciseDefinition } from './types'

const base = `${import.meta.env.BASE_URL}exercises-generated/`
const online = `${import.meta.env.BASE_URL}exercises-online/`

// Workbook identifiers are preserved: images must also resolve without a library definition.
const WORKOUT_IMAGE_ALIASES: Record<string, string> = {
  cable_er_75_90: 'cable_er_75_90',
  matrix_leg_press: 'matrix_leg_press', leg_press: 'matrix_leg_press',
  neutral_grip_pullup: 'neutral_grip_pullup', neutral_pullup: 'neutral_grip_pullup',
  machine_shoulder_press: 'machine_shoulder_press',
  lat_pulldown_medium: 'lat_pulldown_medium.gif',
  matrix_seated_row_unilateral: 'matrix_seated_row_unilateral.gif',
  matrix_chest_press: 'matrix_chest_press.gif',
  cable_ir: 'cable_ir', cable_internal_rotation: 'cable_ir',
  incline_db_bottom_start: 'incline_db_bottom_start', incline_db_press: 'incline_db_bottom_start',
  longer_lever_cable_fly: 'longer_lever_cable_fly',
  matrix_leg_curl: 'matrix_leg_curl.gif', seated_leg_curl: 'matrix_leg_curl.gif',
  one_arm_db_preacher: 'one_arm_db_preacher',
  one_arm_cable_triceps_pushdown: 'one_arm_cable_triceps_pushdown', one_arm_cable_pushdown: 'one_arm_cable_triceps_pushdown'
}

const exerciseDb = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@main/'
const gymPlannerDb = 'https://cdn.jsdelivr.net/gh/H-Ossama/GYM_planner@main/app/src/main/assets/exercices-gifs/'
const gymWikiDb = 'https://cdn.jsdelivr.net/gh/maistrenko-roman/Gym_Wiki@main/public/exercises/'

// Internet illustrations selected for the complete 2026-10-11 registry.
// Existing curated local WebP aliases above keep priority; these URLs cover the remaining registry IDs.
const EXTERNAL_EXERCISE_IMAGES: Record<string, string> = {
  old_hammer_shoulder_press: `${exerciseDb}delts/lever-shoulder-press.gif`,
  old_leg_press: `${exerciseDb}glutes/sled-45-leg-press.gif`,
  old_db_lateral_raise_standing: `${exerciseDb}delts/dumbbell-lateral-raise.gif`,
  old_leg_extension: `${exerciseDb}quads/lever-leg-extension.gif`,
  old_reverse_pec_deck: `${exerciseDb}delts/lever-seated-reverse-fly.gif`,
  old_leg_curl: `${exerciseDb}hamstrings/lever-lying-leg-curl.gif`,
  old_cable_pushdown: `${exerciseDb}triceps/cable-pushdown.gif`,
  old_reverse_ez_curl: `${exerciseDb}biceps/ez-barbell-reverse-grip-curl.gif`,
  old_db_shrug: `${exerciseDb}traps/dumbbell-shrug.gif`,
  old_dips: `${exerciseDb}pectorals/chest-dip.gif`,
  old_db_pullover: `${exerciseDb}pectorals/dumbbell-pullover.gif`,
  old_lat_pulldown: `${exerciseDb}lats/cable-pulldown.gif`,
  old_incline_db_press: `${exerciseDb}pectorals/dumbbell-incline-bench-press.gif`,
  old_straight_bar_curl: `${exerciseDb}biceps/barbell-curl.gif`,
  old_db_skullcrusher: `${exerciseDb}triceps/dumbbell-lying-triceps-extension.gif`,
  old_hammer_curl: `${exerciseDb}biceps/dumbbell-hammer-curl.gif`,
  old_ez_curl: `${exerciseDb}biceps/ez-barbell-curl.gif`,
  old_hammer_chest_press: `${exerciseDb}pectorals/lever-chest-press.gif`,
  old_overhead_cable_extension: `${exerciseDb}triceps/cable-overhead-triceps-extension-rope-attachment.gif`,
  old_seated_row: `${exerciseDb}upper-back/lever-seated-row.gif`,
  old_pec_deck: `${exerciseDb}pectorals/lever-seated-fly.gif`,
  old_close_grip_pushup: `${exerciseDb}triceps/close-grip-push-up.gif`,
  old_bench_dips: `${exerciseDb}triceps/bench-dip-knees-bent.gif`,

  matrix_leg_extension: `${exerciseDb}quads/lever-leg-extension.gif`,
  standing_db_curl: `${exerciseDb}biceps/dumbbell-standing-biceps-curl.gif`,
  db_hammer_curl: `${exerciseDb}biceps/dumbbell-hammer-curl.gif`,
  matrix_triceps_pressdown_v: `${exerciseDb}triceps/cable-triceps-pushdown-v-bar.gif`,
  seated_db_shoulder_press: `${exerciseDb}delts/dumbbell-seated-shoulder-press.gif`,
  seated_db_lateral_raise: `${exerciseDb}delts/dumbbell-seated-lateral-raise.gif`,
  seated_row_generic: `${exerciseDb}upper-back/lever-seated-row.gif`,
  one_arm_row_generic: `${exerciseDb}upper-back/dumbbell-one-arm-bent-over-row.gif`,
  face_pull: `${gymPlannerDb}shoulder_gifs/face_pull.gif`,
  db_pullover: `${exerciseDb}pectorals/dumbbell-pullover.gif`,
  retro_new_incline_machine_press: `${exerciseDb}pectorals/lever-incline-chest-press.gif`,
  pec_deck: `${exerciseDb}pectorals/lever-seated-fly.gif`,
  rope_pushdown: `${exerciseDb}triceps/cable-pushdown-with-rope-attachment.gif`,
  reverse_grip_pushdown: `${exerciseDb}triceps/cable-reverse-grip-pushdown.gif`,
  ez_preacher_curl: `${exerciseDb}biceps/ez-barbell-close-grip-preacher-curl.gif`,
  bulgarian_split_squat: `${exerciseDb}quads/dumbbell-single-leg-split-squat.gif`,
  lateral_raise_machine: `${exerciseDb}delts/lever-lateral-raise.gif`,
  lat_pulldown_wide: `${exerciseDb}lats/cable-pulldown-pro-lat-bar.gif`,
  matrix_seated_row: `${exerciseDb}upper-back/lever-seated-row.gif`,
  reverse_pec_deck: `${exerciseDb}delts/lever-seated-reverse-fly.gif`,
  hip_adductor: `${exerciseDb}adductors/lever-seated-hip-adduction.gif`,
  hip_abductor: `${exerciseDb}abductors/lever-seated-hip-abduction.gif`,
  matrix_biceps_curl: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Lever-Biceps-Curl.gif',
  cable_rear_delt_fly: `${gymPlannerDb}shoulder_gifs/cable_rear_delt_fly.gif`,

  er_isometric: `${exerciseDb}delts/cable-standing-shoulder-external-rotation.gif`,
  ir_isometric: `${exerciseDb}delts/cable-seated-shoulder-internal-rotation.gif`,
  abduction_isometric: `${exerciseDb}delts/cable-one-arm-lateral-raise.gif`,
  scaption: `${exerciseDb}delts/dumbbell-full-can-lateral-raise.gif`,
  cable_er_elbow_tucked: `${exerciseDb}delts/cable-standing-shoulder-external-rotation.gif`,
  db_lateral_raise: `${exerciseDb}delts/dumbbell-lateral-raise.gif`,
  db_sumo_squat: `${gymPlannerDb}leg_gifs/plie_dumbbell_squat.gif`,
  one_arm_cable_lateral_raise: `${exerciseDb}delts/cable-one-arm-lateral-raise.gif`,
  incline_db_press_legacy: `${exerciseDb}pectorals/dumbbell-incline-bench-press.gif`,
  wide_grip_pullup: `${exerciseDb}lats/wide-grip-pull-up.gif`,
  retro_new_cable_seated_row_unilateral: `${exerciseDb}upper-back/cable-seated-one-arm-alternate-row.gif`,
  one_arm_cable_rear_delt: `${exerciseDb}delts/cable-cross-over-revers-fly.gif`,
  cable_er_30_45: `${exerciseDb}delts/cable-standing-shoulder-external-rotation.gif`,
  cable_er_45_60: `${exerciseDb}delts/cable-standing-shoulder-external-rotation.gif`,
  cable_er_60_75: `${exerciseDb}delts/cable-standing-shoulder-external-rotation.gif`,
  one_arm_bayesian_curl: `${gymWikiDb}Cable-Single-Arm-Bayesian-Curl.gif`,
  matrix_triceps_extension: `${exerciseDb}triceps/lever-triceps-extension.gif`,
  walking_lunges: `${exerciseDb}glutes/dumbbell-lunge.gif`,
  short_lever_cable_fly: `${exerciseDb}pectorals/cable-one-arm-decline-chest-fly.gif`
}

export const BUILTIN_EXERCISE_IMAGES: Record<string, string> = {
  barbell_rdl: `${base}barbell_rdl.png`,
  bulgarian_split_squat: `${base}bulgarian_split_squat.png`,
  cable_er_75_90: `${base}cable_er_75_90.png`,
  cable_internal_rotation: `${base}cable_internal_rotation.webp`,
  db_lateral_raise: `${base}db_lateral_raise.png`,
  db_shrug: `${base}db_shrug.webp`,
  ez_preacher_curl: `${base}ez_preacher_curl.png`,
  face_pull: `${base}face_pull.png`,
  incline_db_press: `${base}incline_db_press.png`,
  lat_pulldown_medium: `${base}lat_pulldown_medium.png`,
  leg_press: `${base}leg_press.png`,
  matrix_leg_extension: `${base}matrix_leg_extension.webp`,
  medium_lever_cable_fly: `${base}medium_lever_cable_fly.webp`,
  one_arm_cable_pushdown: `${base}one_arm_cable_pushdown.webp`,
  one_arm_db_preacher: `${base}one_arm_db_preacher.webp`,
  reverse_grip_barbell_row: `${base}reverse_grip_barbell_row.webp`,
  rope_pushdown: `${base}rope_pushdown.png`
}
const esc = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[char] || char))

const paletteFor = (muscle = '') => {
  const s = muscle.toLowerCase()
  if (/груд/.test(s)) return ['#ff7a66','#ffb08f']
  if (/спин/.test(s)) return ['#6aa9ff','#89d3ff']
  if (/плеч|дельт/.test(s)) return ['#7d8cff','#c08cff']
  if (/квад|ног|бедр|ягод|привод/.test(s)) return ['#9a7bff','#d9a7ff']
  if (/бицеп|предплеч/.test(s)) return ['#ffab45','#ffd26f']
  if (/трицеп/.test(s)) return ['#ff6d8f','#ff9fbb']
  if (/трап/.test(s)) return ['#5cc8a7','#9ce4ce']
  return ['#46c27f','#98e2b5']
}

const poseFor = (pattern = '') => {
  const p = pattern.toLowerCase()
  if (/hip hinge/.test(p)) return 'hinge'
  if (/вертикальн.*тяга/.test(p)) return 'vertical-pull'
  if (/горизонтальн.*тяга/.test(p)) return 'horizontal-pull'
  if (/вертикальн.*жим/.test(p)) return 'vertical-press'
  if (/горизонтальн.*жим|наклонн.*жим/.test(p)) return 'horizontal-press'
  if (/присед|одноногий присед/.test(p)) return 'squat'
  if (/выпад/.test(p)) return 'lunge'
  if (/жим ногами/.test(p)) return 'leg-press'
  if (/разгибание колена/.test(p)) return 'leg-extension'
  if (/сгибание колена/.test(p)) return 'leg-curl'
  if (/отведение бедра|приведение бедра/.test(p)) return 'hip-machine'
  if (/наружн.*ротац|внутренн.*ротац/.test(p)) return 'rotation'
  if (/отведение плеча|scaption/.test(p)) return 'lateral'
  if (/задняя дельта|горизонтальное разгибание/.test(p)) return 'rear-delt'
  if (/горизонтальное приведение/.test(p)) return 'fly'
  if (/сгибание локтя/.test(p)) return 'curl'
  if (/разгибание локтя/.test(p)) return 'extension'
  if (/элевация лопатки/.test(p)) return 'shrug'
  if (/разгибание плеча/.test(p)) return 'pullover'
  if (/жим собственным весом/.test(p)) return 'bodyweight-press'
  return 'neutral'
}

const equipmentGlyph = (equipment = '') => {
  const e = equipment.toLowerCase()
  if (/matrix|тренаж|hammer|livepro/.test(e)) return '<rect x="70" y="120" width="52" height="330" rx="18" fill="#323a36"/><rect x="104" y="142" width="92" height="18" rx="9" fill="#66706a"/>'
  if (/кроссовер|блок/.test(e)) return '<rect x="68" y="95" width="30" height="370" rx="15" fill="#323a36"/><circle cx="83" cy="125" r="10" fill="#78837d"/><path d="M83 136 L185 220" stroke="#77817b" stroke-width="6"/>'
  if (/штанг|ez/.test(e)) return '<path d="M110 445 H610" stroke="#59625d" stroke-width="12" stroke-linecap="round"/><circle cx="135" cy="445" r="28" fill="#303734"/><circle cx="585" cy="445" r="28" fill="#303734"/>'
  if (/гантел/.test(e)) return '<g fill="#323a36"><rect x="118" y="402" width="62" height="18" rx="9"/><rect x="112" y="390" width="16" height="42" rx="8"/><rect x="170" y="390" width="16" height="42" rx="8"/></g>'
  if (/турник|брусь/.test(e)) return '<path d="M95 122 H625" stroke="#39413d" stroke-width="16" stroke-linecap="round"/>'
  if (/скам/.test(e)) return '<rect x="175" y="410" width="330" height="30" rx="15" fill="#39413d"/>'
  if (/стена/.test(e)) return '<rect x="70" y="90" width="24" height="420" rx="12" fill="#515b55"/>'
  return ''
}

const poseSvg = (pose: string, accent: string) => {
  const body = '#f1f5f2'
  const joint = '#dfe6e1'
  const line = (d: string, w = 30, color = body) => `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  switch (pose) {
    case 'hinge':
      return `<circle cx="360" cy="175" r="34" fill="${body}"/>${line('M345 214 L300 320',44)}${line('M300 320 L250 455',34)}${line('M300 320 L375 455',34)}${line('M320 250 L215 345',28,accent)}${line('M320 250 L405 360',28,accent)}`
    case 'vertical-pull':
      return `<circle cx="360" cy="210" r="34" fill="${body}"/>${line('M360 250 L360 385',46)}${line('M342 275 L245 145',28,accent)}${line('M378 275 L475 145',28,accent)}${line('M350 390 L300 520',30)}${line('M370 390 L420 520',30)}`
    case 'horizontal-pull':
      return `<circle cx="332" cy="215" r="34" fill="${body}"/>${line('M320 255 L290 390',46)}${line('M315 285 L205 315',28,accent)}${line('M330 300 L470 320',28,accent)}${line('M290 390 L250 520',30)}${line('M300 390 L380 505',30)}`
    case 'vertical-press':
      return `<circle cx="360" cy="225" r="34" fill="${body}"/>${line('M360 265 L360 405',46)}${line('M345 290 L285 155',30,accent)}${line('M375 290 L435 155',30,accent)}${line('M350 405 L310 525',30)}${line('M370 405 L410 525',30)}`
    case 'horizontal-press':
      return `<circle cx="285" cy="332" r="32" fill="${body}"/>${line('M320 340 L470 355',46)}${line('M340 340 L325 230',28,accent)}${line('M430 352 L445 238',28,accent)}${line('M450 365 L520 455',30)}${line('M470 370 L565 430',30)}`
    case 'squat':
      return `<circle cx="360" cy="180" r="34" fill="${body}"/>${line('M360 220 L360 350',48)}${line('M338 270 L265 330',28,accent)}${line('M382 270 L455 330',28,accent)}${line('M350 350 L290 440 L220 455',34)}${line('M370 350 L430 440 L500 455',34)}`
    case 'lunge':
      return `<circle cx="350" cy="175" r="34" fill="${body}"/>${line('M350 215 L350 350',46)}${line('M330 275 L270 345',28)}${line('M370 275 L430 345',28)}${line('M345 350 L265 445 L175 455',34,accent)}${line('M365 350 L455 430 L530 520',34,accent)}`
    case 'leg-press':
      return `<circle cx="265" cy="285" r="32" fill="${body}"/>${line('M300 305 L420 365',46)}${line('M405 365 L515 295',34,accent)}${line('M515 295 L585 205',34,accent)}${line('M405 375 L520 420',34,accent)}${line('M520 420 L600 350',34,accent)}`
    case 'leg-extension':
      return `<circle cx="310" cy="205" r="32" fill="${body}"/>${line('M310 245 L330 380',46)}${line('M330 380 L440 390',36)}${line('M440 390 L565 390',34,accent)}${line('M322 285 L250 350',28)}`
    case 'leg-curl':
      return `<circle cx="300" cy="210" r="32" fill="${body}"/>${line('M300 250 L330 385',46)}${line('M330 385 L445 390',36)}${line('M445 390 L500 485',34,accent)}${line('M318 290 L245 350',28)}`
    case 'hip-machine':
      return `<circle cx="360" cy="205" r="32" fill="${body}"/>${line('M360 245 L360 385',46)}${line('M350 385 L270 455',36,accent)}${line('M370 385 L450 455',36,accent)}${line('M338 285 L285 350',28)}${line('M382 285 L435 350',28)}`
    case 'rotation':
      return `<circle cx="360" cy="195" r="34" fill="${body}"/>${line('M360 235 L360 410',46)}${line('M345 285 L270 285',30)}${line('M270 285 L270 365',30,accent)}${line('M375 285 L450 285',30)}${line('M350 410 L315 525',30)}${line('M370 410 L405 525',30)}`
    case 'lateral':
      return `<circle cx="360" cy="195" r="34" fill="${body}"/>${line('M360 235 L360 410',46)}${line('M340 280 L205 235',28,accent)}${line('M380 280 L515 235',28,accent)}${line('M350 410 L315 525',30)}${line('M370 410 L405 525',30)}`
    case 'rear-delt':
      return `<circle cx="360" cy="205" r="34" fill="${body}"/>${line('M350 245 L310 365',46)}${line('M330 285 L210 330',28,accent)}${line('M350 285 L490 330',28,accent)}${line('M305 365 L260 510',30)}${line('M320 365 L390 500',30)}`
    case 'fly':
      return `<circle cx="360" cy="195" r="34" fill="${body}"/>${line('M360 235 L360 410',46)}${line('M345 280 L230 325',28,accent)}${line('M375 280 L490 325',28,accent)}${line('M350 410 L315 525',30)}${line('M370 410 L405 525',30)}`
    case 'curl':
      return `<circle cx="360" cy="190" r="34" fill="${body}"/>${line('M360 230 L360 415',46)}${line('M340 285 L290 365',30)}${line('M290 365 L335 300',30,accent)}${line('M380 285 L430 365',30)}${line('M430 365 L385 300',30,accent)}${line('M350 415 L315 525',30)}${line('M370 415 L405 525',30)}`
    case 'extension':
      return `<circle cx="360" cy="190" r="34" fill="${body}"/>${line('M360 230 L360 415',46)}${line('M340 285 L290 340',30)}${line('M290 340 L260 430',30,accent)}${line('M380 285 L430 340',30)}${line('M430 340 L460 430',30,accent)}${line('M350 415 L315 525',30)}${line('M370 415 L405 525',30)}`
    case 'shrug':
      return `<circle cx="360" cy="185" r="34" fill="${body}"/>${line('M360 225 L360 410',48)}${line('M335 260 L270 395',32,accent)}${line('M385 260 L450 395',32,accent)}${line('M350 410 L315 525',30)}${line('M370 410 L405 525',30)}`
    case 'pullover':
      return `<circle cx="290" cy="330" r="32" fill="${body}"/>${line('M325 340 L470 350',46)}${line('M345 335 L260 225',28,accent)}${line('M430 350 L525 250',28,accent)}${line('M455 365 L535 445',30)}`
    case 'bodyweight-press':
      return `<circle cx="225" cy="315" r="30" fill="${body}"/>${line('M260 325 L470 360',42)}${line('M315 340 L285 430',30,accent)}${line('M420 355 L390 445',30,accent)}${line('M470 360 L585 390',30)}`
    default:
      return `<circle cx="360" cy="195" r="34" fill="${body}"/>${line('M360 235 L360 410',46)}${line('M340 280 L290 360',28,accent)}${line('M380 280 L430 360',28,accent)}${line('M350 410 L315 525',30)}${line('M370 410 L405 525',30)}`
  }
}

const illustrationCache = new Map<string, string>()

export function generatedExerciseIllustration(def: ExerciseDefinition) {
  const cached = illustrationCache.get(def.id)
  if (cached) return cached
  const [accentA, accentB] = paletteFor(def.muscleGroup)
  const pose = poseFor(def.movementPattern)
  const equipment = equipmentGlyph(def.equipment)
  const label = esc(def.name.length > 34 ? `${def.name.slice(0, 31)}…` : def.name)
  const subLabel = esc(def.equipment || def.muscleGroup || 'Exercise')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111714"/><stop offset="1" stop-color="#253129"/></linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accentA}"/><stop offset="1" stop-color="${accentB}"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".28"/></filter>
    </defs>
    <rect width="720" height="720" rx="48" fill="url(#bg)"/>
    <circle cx="610" cy="92" r="138" fill="${accentA}" opacity=".12"/>
    <circle cx="82" cy="628" r="170" fill="${accentB}" opacity=".09"/>
    <g opacity=".9">${equipment}</g>
    <g filter="url(#shadow)">${poseSvg(pose, accentA)}</g>
    <rect x="44" y="604" width="632" height="72" rx="24" fill="#0c100e" opacity=".62"/>
    <circle cx="82" cy="640" r="13" fill="url(#accent)"/>
    <text x="108" y="635" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="700" fill="#e8efeb">${label}</text>
    <text x="108" y="658" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="600" fill="#aeb9b2">${subLabel}</text>
  </svg>`
  const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
  illustrationCache.set(def.id, uri)
  return uri
}

export function exerciseImageForDefinition(def?: ExerciseDefinition, exerciseId?: string) {
  const id = exerciseId || def?.id || ''
  const illustration = WORKOUT_IMAGE_ALIASES[id]
  if (illustration) return `${online}${illustration.includes('.') ? illustration : `${illustration}.webp`}`
  const external = EXTERNAL_EXERCISE_IMAGES[id]
  if (external) return external
  if (!def) return undefined
  return BUILTIN_EXERCISE_IMAGES[def.id] || generatedExerciseIllustration(def)
}

export const EXERCISE_IMAGE_CREDIT = 'Иллюстрации упражнений: внешние учебные источники; полный список источников — SOURCES.md. Интернет-GIF кэшируются после первого открытия. Специальные rehab-варианты выполняйте по инструкции тренировки.'
