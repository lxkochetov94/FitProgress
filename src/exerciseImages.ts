const base = `${import.meta.env.BASE_URL}exercises-hq/`

export const BUILTIN_EXERCISE_IMAGES: Record<string, string> = {
  barbell_rdl: `${base}barbell_rdl.svg`,
  cable_er_75_90: `${base}cable_er_75_90.svg`,
  cable_internal_rotation: `${base}cable_internal_rotation.svg`,
  db_shrug: `${base}db_shrug.svg`,
  incline_db_press: `${base}incline_db_press.svg`,
  matrix_leg_extension: `${base}matrix_leg_extension.svg`,
  medium_lever_cable_fly: `${base}medium_lever_cable_fly.svg`,
  one_arm_cable_pushdown: `${base}one_arm_cable_pushdown.svg`,
  one_arm_db_preacher: `${base}one_arm_db_preacher.svg`,
  reverse_grip_barbell_row: `${base}reverse_grip_barbell_row.svg`
}

export const EXERCISE_IMAGE_CREDIT = 'Иллюстрации упражнений: Bryl Lim / Workout Guide · CC BY-SA 4.0'
