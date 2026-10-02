export type RetroSetTuple = [label: string, weight: string, reps: string, intensity: string]
export type RetroExerciseTuple = [exerciseId: string, name: string, sets: RetroSetTuple[]]
export type RetroWorkoutTuple = [
  id: string,
  order: number,
  date: string | null,
  periodKey: string,
  periodLabel: string,
  gym: string,
  title: string,
  exercises: RetroExerciseTuple[]
]
