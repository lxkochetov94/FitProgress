import { useMemo, useState } from 'react'
import './analytics.css'
import { exerciseSeries, filterByPeriod, formatMetric, latestWorkout, loadAnalyticsWorkouts, overallStrengthIndex, primarySets } from './analyticsModel'
import type { AnalyticsPeriod, ExercisePoint, IndexPoint } from './analyticsModel'

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '1m', label: '1 месяц' },
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: '6 месяцев' },
  { id: '12m', label: '12 месяцев' }
]

const fmtFullDate = (value: string | null, fallback: string) => value
  ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
  : fallback

function trend(first: number | null | undefined, last: number | null | undefined, mode: 'percent' | 'absolute' = 'percent') {
  if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last)) return '—'
  const diff = last - first
  if (mode === 'absolute') return `${diff > 0 ? '+' : ''}${formatMetric(diff, 1)}`
  if (first === 0) return '—'
  const pct = diff / first * 100
  return `${pct > 0 ? '+' : ''}${formatMetric(pct, 1)}%`
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const data = values.map((value, index) => ({ value, index })).filter((item): item is { value: number; index: number } => item.value != null && Number.isFinite(item.value))
  if (data.length < 2) return <span className="analytics-spark-empty">—</span>
  const min = Math.min(...data.map((item) => item.value))
  const max = Math.max(...data.map((item) => item.value))
  const span = Math.max(max - min, Math.max(Math.abs(max), 1) * .08)
  const pts = data.map((item) => {
    const x = data.length === 1 ? 40 : item.index / Math.max(values.length - 1, 1) * 80
    const y = 24 - ((item.value - min) / span) * 20
    return `${x},${y}`
  }).join(' ')
  return <svg className="analytics-spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} /></svg>
}

function IndexChart({ points }: { points: IndexPoint[] }) {
  const [selected, setSelected] = useState(Math.max(0, points.length - 1))
  if (!points.length) return <div className="analytics-empty-chart">Недостаточно сопоставимых тренировок для индекса.</div>
  const selectedIndex = Math.min(selected, points.length - 1)
  const active = points[selectedIndex]
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 8)
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? 160 : 18 + index / (points.length - 1) * 284,
    y: 118 - ((point.value - min) / span) * 84
  }))
  return (
    <div className="analytics-chart-wrap">
      <div className="analytics-chart-callout"><b>{formatMetric(active.value, 1)}%</b><span>{active.dateLabel} · {active.count} упр.</span></div>
      <svg className="analytics-chart" viewBox="0 0 320 136" role="img" aria-label="Динамика силового индекса">
        <line x1="18" x2="302" y1="118" y2="118" className="chart-axis" />
        <polyline points={coords.map((point) => `${point.x},${point.y}`).join(' ')} className="chart-line" />
        {coords.map((point, index) => <circle key={points[index].workoutId} cx={point.x} cy={point.y} r={index === selectedIndex ? 6 : 4} className={index === selectedIndex ? 'chart-point active' : 'chart-point'} onClick={() => setSelected(index)} />)}
      </svg>
      <div className="analytics-axis-labels"><span>{points[0].dateLabel}</span><span>{points.at(-1)?.dateLabel}</span></div>
    </div>
  )
}

function SetDetails({ point }: { point: ExercisePoint }) {
  return (
    <div className="analytics-point-detail">
      <div className="analytics-point-head"><div><span>{point.dateLabel}</span><b>{point.workoutTitle}</b></div>{point.workWeight != null && <strong>{formatMetric(point.workWeight, 1)} {point.weightUnit}</strong>}</div>
      <div className="analytics-set-list">
        {point.primarySets.map((set, index) => <div key={`${set.label}-${index}`}><span>{/^\d/.test(set.label) ? `Подход ${index + 1}` : set.label}</span><b>{[set.weight, set.reps && `× ${set.reps}`].filter(Boolean).join(' ')}</b>{(set.rir || set.pain || set.intensity) && <small>{set.rir ? `RIR ${set.rir}` : set.intensity}{set.pain ? ` · боль ${set.pain}/10` : ''}</small>}</div>)}
      </div>
      <div className="analytics-total"><span>Всего повторений</span><b>{formatMetric(point.totalReps, 1)}</b>{point.prepSetCount > 0 && <small>+ {point.prepSetCount} подготовит. подхода</small>}</div>
    </div>
  )
}

function ExerciseChart({ points }: { points: ExercisePoint[] }) {
  const [selected, setSelected] = useState(Math.max(0, points.length - 1))
  if (!points.length) return null
  const weighted = points.some((point) => point.workWeight != null)
  const valueOf = (point: ExercisePoint) => point.workWeight ?? Math.max(...point.setReps)
  const valid = points.map((point, index) => ({ point, index, value: valueOf(point) })).filter((item): item is { point: ExercisePoint; index: number; value: number } => item.value != null && Number.isFinite(item.value))
  const selectedIndex = Math.min(selected, points.length - 1)
  const active = points[selectedIndex]
  if (!valid.length) return <SetDetails point={active} />
  const values = valid.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, Math.max(Math.abs(max), 1) * .12)
  const coords = valid.map((item, index) => ({
    ...item,
    x: valid.length === 1 ? 160 : 18 + index / (valid.length - 1) * 284,
    y: 118 - ((item.value - min) / span) * 84
  }))
  return (
    <>
      <div className="analytics-chart-wrap exercise-chart-wrap">
        <div className="analytics-chart-caption"><span>{weighted ? 'Рабочий вес' : 'Повторы в лучшем подходе'}</span><b>{weighted ? `${formatMetric(valueOf(active) ?? 0, 1)} ${active.weightUnit ?? ''}` : `${formatMetric(valueOf(active) ?? 0, 1)} повт.`}</b></div>
        <svg className="analytics-chart" viewBox="0 0 320 136" role="img" aria-label="Динамика упражнения">
          <line x1="18" x2="302" y1="118" y2="118" className="chart-axis" />
          <polyline points={coords.map((item) => `${item.x},${item.y}`).join(' ')} className="chart-line" />
          {coords.map((item) => <circle key={item.point.workoutId} cx={item.x} cy={item.y} r={item.index === selectedIndex ? 6 : 4} className={item.index === selectedIndex ? 'chart-point active' : 'chart-point'} onClick={() => setSelected(item.index)} />)}
        </svg>
        <div className="analytics-axis-labels"><span>{valid[0]?.point.dateLabel}</span><span>{valid.at(-1)?.point.dateLabel}</span></div>
      </div>
      <SetDetails point={active} />
    </>
  )
}

function MetricRow({ label, values, unit, absolute = false }: { label: string; values: (number | null)[]; unit?: string; absolute?: boolean }) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value))
  const first = clean[0]
  const last = clean.at(-1)
  return (
    <div className="analytics-metric-row">
      <div className="analytics-metric-name"><b>{label}</b><span>{last == null ? '—' : `${formatMetric(last, 1)}${unit ? ` ${unit}` : ''}`}</span></div>
      <Sparkline values={values} />
      <strong className={(first != null && last != null && last >= first) ? 'positive' : ''}>{trend(first, last, absolute ? 'absolute' : 'percent')}</strong>
    </div>
  )
}

function ExerciseCard({ name, points }: { name: string; points: ExercisePoint[] }) {
  if (!points.length) return null
  const latest = points.at(-1)!
  const first = points[0]
  const scoreTrend = trend(first.score, latest.score)
  const maxSets = Math.max(...points.map((point) => point.setReps.length))
  const weighted = points.some((point) => point.workWeight != null)
  return (
    <article className="analytics-exercise-card">
      <div className="analytics-exercise-head">
        <div><span className="eyebrow">{points.length} ТРЕНИРОВОК В ПЕРИОДЕ</span><h2>{name}</h2></div>
        <span className={`analytics-delta ${latest.score >= first.score ? 'positive' : ''}`}>{scoreTrend}</span>
      </div>
      <ExerciseChart points={points} />
      <div className="analytics-distribution">
        {weighted && <MetricRow label="Рабочий вес" values={points.map((point) => point.workWeight)} unit={latest.weightUnit ?? ''} />}
        {weighted && <MetricRow label="Пиковый вес" values={points.map((point) => point.peakWeight)} unit={latest.weightUnit ?? ''} />}
        {Array.from({ length: maxSets }).map((_, index) => <MetricRow key={index} label={`${index + 1}-й подход`} values={points.map((point) => point.setReps[index] ?? null)} unit="повт." absolute />)}
        <MetricRow label="Всего повторений" values={points.map((point) => point.totalReps)} unit="повт." absolute />
      </div>
    </article>
  )
}

export default function AnalyticsView({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('3m')
  const workouts = useMemo(() => loadAnalyticsWorkouts(), [])
  const latest = useMemo(() => latestWorkout(workouts), [workouts])
  const filtered = useMemo(() => filterByPeriod(workouts, period, latest?.date), [workouts, period, latest?.date])
  const latestExercises = useMemo(() => latest?.exercises.filter((exercise) => primarySets(exercise).length) ?? [], [latest])
  const ids = latestExercises.map((exercise) => exercise.exerciseId)
  const strength = useMemo(() => overallStrengthIndex(filtered, ids), [filtered, ids.join('|')])
  const strengthDelta = strength.length > 1 ? trend(strength[0].value, strength.at(-1)?.value) : '—'

  return (
    <main className="app-shell analytics-page">
      <header className="topbar sticky"><button className="back" onClick={onBack}>‹</button><span>Аналитика</span><span className="status-dot">прогресс</span></header>
      <section className="analytics-hero">
        <span className="pill">Сила · веса · повторы</span>
        <h1>Прогресс без шума.</h1>
        <p>Показываем только упражнения из последней выполненной тренировки и сравниваем их с собственной историей.</p>
      </section>

      <div className="analytics-periods" role="tablist" aria-label="Период аналитики">
        {PERIODS.map((item) => <button key={item.id} className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
      </div>

      <section className="analytics-index-card">
        <div className="analytics-index-head"><div><span className="eyebrow">ОБЩАЯ ДИНАМИКА</span><h2>Силовой индекс</h2><p>100% = первая доступная точка каждого упражнения в выбранном периоде.</p></div><strong className={strength.length > 1 && strength.at(-1)!.value >= strength[0].value ? 'positive' : ''}>{strengthDelta}</strong></div>
        <IndexChart points={strength} />
      </section>

      {latest && <section className="analytics-latest"><span className="eyebrow">ПОСЛЕДНЯЯ ТРЕНИРОВКА</span><h2>{latest.title}</h2><p>{fmtFullDate(latest.date, latest.periodLabel)} · {latestExercises.length} упражнений с фактом</p></section>}

      <section className="analytics-cards">
        {latestExercises.map((exercise) => <ExerciseCard key={exercise.exerciseId} name={exercise.name} points={exerciseSeries(filtered, exercise.exerciseId)} />)}
      </section>

      <section className="analytics-note"><b>Ретроспектива загружена</b><p>В аналитику встроены 31 тренировка из ревизии 29.06–29.09. Для Т04–Т09 точные дни в источнике отсутствуют, поэтому на графиках они остаются периодом «Июль 2026» без выдуманных дат. Новые тренировки сохраняются в отдельный аналитический архив и не меняют механику основного дневника.</p></section>
    </main>
  )
}
