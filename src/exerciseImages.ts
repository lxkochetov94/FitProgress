const base = `${import.meta.env.BASE_URL}exercises-generated/`

export const BUILTIN_EXERCISE_IMAGES: Record<string, string> = {
  barbell_rdl: `${base}barbell_rdl.webp`,
  cable_er_75_90: `${base}cable_er_75_90.webp`,
  cable_internal_rotation: `${base}cable_internal_rotation.webp`,
  db_shrug: `${base}db_shrug.webp`,
  incline_db_press: `${base}incline_db_press.webp`,
  matrix_leg_extension: `${base}matrix_leg_extension.webp`,
  medium_lever_cable_fly: `${base}medium_lever_cable_fly.webp`,
  one_arm_cable_pushdown: `${base}one_arm_cable_pushdown.webp`,
  one_arm_db_preacher: `${base}one_arm_db_preacher.webp`,
  reverse_grip_barbell_row: `${base}reverse_grip_barbell_row.webp`
}

export const EXERCISE_IMAGE_CREDIT = 'Иллюстрации упражнений сгенерированы специально для FitProgress'
