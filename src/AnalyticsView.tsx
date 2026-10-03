import { useId, useMemo, useState } from 'react'
import './analytics.css'
import { exerciseSeries, filterByPeriod, formatMetric, latestWorkout, loadAnalyticsWorkouts, primarySets, workoutVolumeSeries } from './analyticsModel'
import type { AnalyticsPeriod, ExercisePoint, VolumePoint } from './analyticsModel'
import { buildStimulusDashboard } from './trainingStimulus'
import type { MuscleStimulusSummary, StimulusDashboard, StimulusStatus } from './trainingStimulus'

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '1m', label: '1 месяц' },
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: '6 месяцев' },
  { id: '12m', label: '12 месяцев' }
]

type ChartCoord = { x: number; y: number }

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

function linePath(points: ChartCoord[]) {
  if (!points.length) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function areaPath(points: ChartCoord[], bottom = 124) {
  if (points.length < 2) return ''
  return `${linePath(points)} L ${points.at(-1)!.x} ${bottom} L ${points[0].x} ${bottom} Z`
}

function ChartGrid() {
  const lines = [18, 89, 160, 231, 302]
  return (
    <g className="chart-grid" aria-hidden="true">
      {lines.map((x) => <line key={x} x1={x} x2={x} y1="14" y2="124" />)}
      <line x1="18" x2="302" y1="124" y2="124" className="chart-baseline" />
    </g>
  )
}

function ChartValue({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="analytics-chart-value" aria-live="polite">
      <b>{primary}</b>
      <span>{secondary}</span>
    </div>
  )
}

function ChartPoint({ x, y, active, onSelect }: { x: number; y: number; active: boolean; onSelect: () => void }) {
  return (
    <g className={active ? 'chart-dot-group active' : 'chart-dot-group'} onClick={onSelect}>
      <circle cx={x} cy={y} r="14" className="chart-touch-target" />
      {active && <circle cx={x} cy={y} r="12" className="chart-point-halo" />}
      <circle cx={x} cy={y} r={active ? 5.5 : 4.5} className={active ? 'chart-point active' : 'chart-point'} />
    </g>
  )
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const data = values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value != null && Number.isFinite(item.value))
  if (data.length < 2) return <span className="analytics-spark-empty">—</span>

  const min = Math.min(...data.map((item) => item.value))
  const max = Math.max(...data.map((item) => item.value))
  const span = Math.max(max - min, Math.max(Math.abs(max), 1) * .08)
  const coords = data.map((item) => ({
    x: item.index / Math.max(values.length - 1, 1) * 80,
    y: 24 - ((item.value - min) / span) * 20
  }))
  return <svg className="analytics-spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true"><path d={linePath(coords)} /></svg>
}

function formatVolume(valueKg: number) {
  if (valueKg >= 1000) return `${formatMetric(valueKg / 1000, 1)} т`
  return `${formatMetric(valueKg, 0)} кг`
}

function VolumeChart({ points }: { points: VolumePoint[] }) {
  const [selected, setSelected] = useState(Math.max(0, points.length - 1))
  const uid = useId().replace(/:/g, '')
  if (!points.length) return <div className="analytics-empty-chart">Недостаточно данных для расчёта общего объёма.</div>

  const selectedIndex = Math.min(selected, points.length - 1)
  const active = points[selectedIndex]
  const values = points.map((point) => point.relative)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, Math.max(Math.abs(max), 1) * .12)
  const coords = points.map((point, index) => ({
    x: points.length === 1 ? 160 : 18 + index / Math.max(points.length - 1, 1) * 284,
    y: 116 - ((point.relative - min) / span) * 78
  }))

  return (
    <div className="analytics-chart-wrap">
      <div className="analytics-chart-toolbar analytics-chart-toolbar-index">
        <ChartValue
          primary={formatVolume(active.volumeKg)}
          secondary={`${active.dateLabel} · ${formatMetric(active.relative, 1)}% от базы`}
        />
      </div>
      <svg className="analytics-chart" viewBox="0 0 320 142" role="img" aria-label="Динамика общего объёма тренировок">
        <defs>
          <linearGradient id={`${uid}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#168246" />
            <stop offset="52%" stopColor="#24a36b" />
            <stop offset="100%" stopColor="#2f7de8" />
          </linearGradient>
          <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2c9d68" stopOpacity=".18" />
            <stop offset="100%" stopColor="#2c9d68" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ChartGrid />
        {coords.length > 1 && <path d={areaPath(coords)} fill={`url(#${uid}-fill)`} className="chart-area" />}
        <path d={linePath(coords)} stroke={`url(#${uid}-stroke)`} className="chart-line" />
        {coords.map((point, index) => (
          <ChartPoint key={points[index].workoutId} x={point.x} y={point.y} active={index === selectedIndex} onSelect={() => setSelected(index)} />
        ))}
      </svg>
      <div className="analytics-axis-labels"><span>{points[0].dateLabel}</span><span>{points.at(-1)?.dateLabel}</span></div>
    </div>
  )
}

function SetDetails({ point, currentName }: { point: ExercisePoint; currentName: string }) {
  const isHistoricalVariant = point.matchedExerciseName !== currentName
  return (
    <div className="analytics-point-detail">
      <div className="analytics-point-head">
        <div>
          <span>{point.dateLabel}</span>
          <b>{point.workoutTitle}</b>
          {isHistoricalVariant && <small>Исторический вариант: {point.matchedExerciseName}</small>}
        </div>
        {point.workWeight != null && <strong>{formatMetric(point.workWeight, 1)} {point.weightUnit}</strong>}
      </div>
      <div className="analytics-set-list">
        {point.allSets.map((set, index) => (
          <div key={`${set.label}-${index}`}>
            <span>{/^\d/.test(set.label) ? `Подход ${set.label}` : set.label}</span>
            <b>{[set.weight, set.reps && `× ${set.reps}`].filter(Boolean).join(' ')}</b>
            {(set.rir || set.pain || set.intensity) && (
              <small>{set.rir ? `RIR ${set.rir}` : set.intensity}{set.pain ? ` · боль ${set.pain}/10` : ''}</small>
            )}
          </div>
        ))}
      </div>
      <div className="analytics-total">
        <span>Всего повторений в учтённых сетах</span>
        <b>{point.totalReps == null ? '—' : formatMetric(point.totalReps, 1)}</b>
        {point.totalReps == null && <small>в источнике есть диапазон/нечисловое значение</small>}
      </div>
    </div>
  )
}

const maxExactReps = (point: ExercisePoint) => {
  const values = point.setReps.filter((value): value is number => value != null)
  return values.length ? Math.max(...values) : null
}

function ExerciseChart({ points, name }: { points: ExercisePoint[]; name: string }) {
  const [selected, setSelected] = useState(Math.max(0, points.length - 1))
  const uid = useId().replace(/:/g, '')
  if (!points.length) return null

  const weighted = points.some((point) => point.workWeight != null)
  const valueOf = (point: ExercisePoint) => point.workWeight ?? maxExactReps(point)
  const valid = points
    .map((point, index) => ({ point, index, value: valueOf(point) }))
    .filter((item): item is { point: ExercisePoint; index: number; value: number } => item.value != null && Number.isFinite(item.value))
  const selectedIndex = Math.min(selected, points.length - 1)
  const active = points[selectedIndex]
  if (!valid.length) return <SetDetails point={active} currentName={name} />

  const values = valid.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, Math.max(Math.abs(max), 1) * .12)
  const coords = valid.map((item, index) => ({
    ...item,
    x: valid.length === 1 ? 160 : 18 + index / Math.max(valid.length - 1, 1) * 284,
    y: 116 - ((item.value - min) / span) * 78
  }))

  const activeValue = valueOf(active)
  const activeLabel = weighted
    ? activeValue == null ? '—' : `${formatMetric(activeValue, 1)} ${active.weightUnit ?? ''}`
    : activeValue == null ? '—' : `${formatMetric(activeValue, 1)} повт.`

  return (
    <>
      <div className="analytics-chart-wrap exercise-chart-wrap">
        <div className="analytics-chart-toolbar">
          <div className="analytics-chart-caption"><span>{weighted ? 'Вес на тренировке' : 'Повторы'}</span></div>
          <ChartValue primary={activeLabel} secondary={active.dateLabel} />
        </div>
        <svg className="analytics-chart" viewBox="0 0 320 142" role="img" aria-label={`Динамика: ${name}`}>
          <defs>
            <linearGradient id={`${uid}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#168246" />
              <stop offset="55%" stopColor="#26a76d" />
              <stop offset="100%" stopColor="#3285ee" />
            </linearGradient>
            <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2c9d68" stopOpacity=".16" />
              <stop offset="100%" stopColor="#2c9d68" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ChartGrid />
          {coords.length > 1 && <path d={areaPath(coords)} fill={`url(#${uid}-fill)`} className="chart-area" />}
          <path d={linePath(coords)} stroke={`url(#${uid}-stroke)`} className="chart-line" />
          {coords.map((item) => (
            <ChartPoint key={item.point.workoutId} x={item.x} y={item.y} active={item.index === selectedIndex} onSelect={() => setSelected(item.index)} />
          ))}
        </svg>
        <div className="analytics-axis-labels"><span>{valid[0]?.point.dateLabel}</span><span>{valid.at(-1)?.point.dateLabel}</span></div>
      </div>
      <SetDetails point={active} currentName={name} />
    </>
  )
}

function MetricRow({ label, values, unit, absolute = false }: { label: string; values: (number | null)[]; unit?: string; absolute?: boolean }) {
  const clean = values.filter((value): value is number => value != null && Number.isFinite(value))
  const first = clean[0]
  const last = clean.at(-1)
  return (
    <div className="analytics-metric-row">
      <div className="analytics-metric-name">
        <b>{label}</b>
        <span>{last == null ? '—' : `${formatMetric(last, 1)}${unit ? ` ${unit}` : ''}`}</span>
      </div>
      <Sparkline values={values} />
      <strong className={(first != null && last != null && last >= first) ? 'positive' : ''}>
        {trend(first, last, absolute ? 'absolute' : 'percent')}
      </strong>
    </div>
  )
}

function ExerciseCard({ name, points, totalCount }: { name: string; points: ExercisePoint[]; totalCount: number }) {
  if (!points.length) return null
  const weighted = points.some((point) => point.workWeight != null)
  const chartValues = points
    .map((point) => point.workWeight ?? maxExactReps(point))
    .filter((value): value is number => value != null)
  const chartTrend = trend(chartValues[0], chartValues.at(-1), weighted ? 'percent' : 'absolute')
  const maxSets = Math.max(...points.map((point) => point.setReps.length))

  return (
    <article className="analytics-exercise-card">
      <div className="analytics-exercise-head">
        <div>
          <span className="eyebrow">
            {points.length} {points.length === 1 ? 'ТРЕНИРОВКА' : 'ТРЕНИРОВОК'} В ПЕРИОДЕ
            {totalCount > points.length ? ` · ${totalCount} ВСЕГО` : ''}
          </span>
          <h2>{name}</h2>
        </div>
        <span className={`analytics-delta ${chartValues.length > 1 && chartValues.at(-1)! >= chartValues[0] ? 'positive' : ''}`}>
          {chartTrend}
        </span>
      </div>

      <ExerciseChart points={points} name={name} />

      <div className="analytics-distribution">
        {weighted && <MetricRow label="Рабочий вес" values={points.map((point) => point.workWeight)} unit={points.at(-1)?.weightUnit ?? ''} />}
        {weighted && <MetricRow label="Пиковый вес" values={points.map((point) => point.peakWeight)} unit={points.at(-1)?.weightUnit ?? ''} />}
        {Array.from({ length: maxSets }).map((_, index) => (
          <MetricRow key={index} label={`${index + 1}-й подход`} values={points.map((point) => point.setReps[index] ?? null)} unit="повт." absolute />
        ))}
        <MetricRow label="Всего повторений" values={points.map((point) => point.totalReps)} unit="повт." absolute />
      </div>
    </article>
  )
}

const STIMULUS_LABELS: Record<StimulusStatus, string> = {
  fresh: 'Свежо',
  within72: '≤3 дней',
  due: 'Пора вернуть',
  high: 'Высокий приоритет',
  none: 'Нет данных'
}

function daysAgoLabel(days: number | null) {
  if (days == null) return '—'
  if (days === 0) return 'сегодня'
  if (days === 1) return '1 день назад'
  if (days >= 2 && days <= 4) return `${days} дня назад`
  return `${days} дней назад`
}

function MuscleStimulusRow({ item }: { item: MuscleStimulusSummary }) {
  return (
    <div className="stimulus-row">
      <div className="stimulus-row-main">
        <b>{item.muscle}</b>
        <span>{formatMetric(item.effectiveSets7d, 2)} условных раб. сетов / 7 дней</span>
      </div>
      <div className="stimulus-row-recency">
        <span>прямой: {daysAgoLabel(item.daysSinceDirect)}</span>
        <span>любой: {daysAgoLabel(item.daysSinceAny)}</span>
      </div>
      <span className={`stimulus-status ${item.status}`}>{STIMULUS_LABELS[item.status]}</span>
      <small>{item.explanation}</small>
    </div>
  )
}

function StimulusPanel({ dashboard }: { dashboard: StimulusDashboard }) {
  const overduePatterns = dashboard.patterns.filter((item) => item.overdue)

  return (
    <section className="analytics-stimulus-card">
      <div className="stimulus-head">
        <span className="eyebrow">ПЛАНИРОВАНИЕ СЛЕДУЮЩЕЙ ТРЕНИРОВКИ</span>
        <h2>Свежесть мышечных групп</h2>
        <p>Показывает, когда мышца последний раз получила прямой или косвенный рабочий стимул и сколько условно-взвешенных рабочих сетов накопилось за 7 дней.</p>
      </div>

      <div className="stimulus-list">
        {dashboard.muscles.map((item) => <MuscleStimulusRow key={item.muscle} item={item} />)}
      </div>

      <div className="pattern-recency">
        <div className="pattern-recency-head">
          <b>Паттерны движения старше 3 дней</b>
          <span>{overduePatterns.length}</span>
        </div>
        {overduePatterns.length ? (
          <div className="pattern-chips">
            {overduePatterns.map((item) => (
              <span key={item.pattern}>
                <b>{item.pattern}</b>
                <small>{daysAgoLabel(item.daysSince)} · {formatMetric(item.workingSets7d)} раб. сетов / 7 дн.</small>
              </span>
            ))}
          </div>
        ) : (
          <p className="pattern-all-fresh">Все рабочие паттерны текущей ротации получали стимул в пределах 3 календарных дней.</p>
        )}
      </div>

      <div className="stimulus-rule-note">
        <b>Как считается</b>
        <p>Рабочий сет даёт основной мышце 1,0 сета; вторичным мышцам — 0,25–0,75 в зависимости от паттерна движения. Разминка, калибровка и rehab-сеты не считаются. Более 3 календарных дней без любого рабочего стимула = «пора вернуть», более 4 дней = высокий приоритет. Это правило планирования частоты, а не жёсткая физиологическая граница восстановления.</p>
      </div>
    </section>
  )
}

export default function AnalyticsView({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('3m')
  const workouts = useMemo(() => loadAnalyticsWorkouts(), [])
  const latest = useMemo(() => latestWorkout(workouts), [workouts])
  const filtered = useMemo(() => filterByPeriod(workouts, period, latest?.date), [workouts, period, latest?.date])
  const latestExercises = useMemo(() => latest?.exercises.filter((exercise) => primarySets(exercise).length) ?? [], [latest])
  const volume = useMemo(() => workoutVolumeSeries(filtered), [filtered])
  const volumeDelta = volume.length > 1 ? trend(volume[0].volumeKg, volume.at(-1)?.volumeKg) : '—'
  const stimulus = useMemo(() => buildStimulusDashboard(workouts), [workouts])

  return (
    <main className="app-shell analytics-page">
      <header className="topbar sticky analytics-topbar">
        <button className="back" onClick={onBack}>‹</button>
        <span>Аналитика тренировок</span>
        <span className="analytics-topbar-spacer" aria-hidden="true" />
      </header>

      <div className="analytics-periods" role="tablist" aria-label="Период аналитики">
        {PERIODS.map((item) => (
          <button key={item.id} className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="analytics-index-card">
        <div className="analytics-index-head">
          <div>
            <span className="eyebrow">ОБЩАЯ ДИНАМИКА</span>
            <h2>Общий объём</h2>
            <p>100% = рабочий тоннаж первой тренировки в выбранном периоде. Тоннаж = сумма внешнего веса × повторения; lb переводятся в кг. Разминка, калибровка, rehab и BW без числового веса не входят.</p>
          </div>
          <strong className={volume.length > 1 && volume.at(-1)!.volumeKg >= volume[0].volumeKg ? 'positive' : ''}>{volumeDelta}</strong>
        </div>
        <VolumeChart points={volume} />
      </section>

      {latest && (
        <section className="analytics-latest">
          <span className="eyebrow">ПОСЛЕДНЯЯ ТРЕНИРОВКА</span>
          <h2>{latest.title}</h2>
          <p>{fmtFullDate(latest.date, latest.periodLabel)} · {latestExercises.length} упражнений с фактом</p>
        </section>
      )}

      <StimulusPanel dashboard={stimulus} />

      <section className="analytics-audit-note">
        <b>Как читать график</b>
        <p>Одна тренировка = одна точка. Точка по весу = максимальный вес среди рабочих/учтённых сетов этой тренировки. «Пиковый вес» ниже учитывает вообще все записанные сеты, включая калибровки и пробы. Нажми на точку — увидишь исходные подходы без скрытого усреднения.</p>
      </section>

      <section className="analytics-cards">
        {latestExercises.map((exercise) => {
          const periodPoints = exerciseSeries(filtered, exercise.exerciseId)
          const allPoints = exerciseSeries(workouts, exercise.exerciseId)
          return (
            <ExerciseCard
              key={exercise.exerciseId}
              name={exercise.name}
              points={periodPoints}
              totalCount={allPoints.length}
            />
          )
        })}
      </section>

      <section className="analytics-note">
        <b>Источник данных</b>
        <p>Встроены 31 ретроспективная тренировка из ревизии 29.06–29.09 плюс все завершённые тренировки FitProgress. Для Т04–Т09 точные дни в исходнике отсутствуют: они остаются «Июль 2026», без выдуманных дат. Новая тренировка попадает в аналитику после её завершения.</p>
      </section>
    </main>
  )
}
