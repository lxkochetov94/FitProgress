export function localDateKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function sessionDateKey(startedAt: string, startedLocalDate?: string) {
  return startedLocalDate || localDateKey(startedAt)
}
