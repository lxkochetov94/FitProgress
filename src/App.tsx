import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AnalyticsView from './AnalyticsView'
import type { ChangeEvent, CSSProperties, ReactNode } from 'react'
import { EXERCISE_LIBRARY, getDefinition, replacementCandidates } from './exerciseLibrary'
import { downloadTemplate, exportFullRegistry, exportSession, importWorkout } from './excel'
import { archiveSession, clearTestWorkoutHistoryOnce, loadActiveSession, loadExerciseProfiles, loadHistory, saveActiveSession } from './storage'
import { EXERCISE_IMAGE_CREDIT, exerciseImageForDefinition } from './exerciseImages'
import { mergeDefinitionWithProfile, profileToDefinition } from './exerciseProgress'
import { SHOULDER_PROFILE } from './shoulderProfile'
import type { ExerciseDefinition, WorkoutExercise, WorkoutPlan, WorkoutSession, WorkoutSet } from './types'
import { sessionWorkingVolumeKg, syncAnalyticsArchive } from './analyticsModel'

clearTestWorkoutHistoryOnce()
syncAnalyticsArchive()

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
const fmtDate = (iso: string) => new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
const fmtTime = (iso: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const fmtDuration = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function createSession(plan: WorkoutPlan): WorkoutSession {
  const now = new Date().toISOString()
  return { sessionId: id(), plan: clone(plan), startedAt: now, updatedAt: now }
}

function parseNumeric(value: string) {
  const match = value.replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : NaN
}

const cleanReps = (value: string) =>
  value.replace(/\s*\/\s*(?:руку|руки|рук|ногу|ноги|ног|сторону|стороны|сторон|arm|leg|side)\b.*$/i, '').trim()

const humanizeInstruction = (value: string) =>
  value
    .replace(/\/\s*руку\b/gi, ' на каждую руку')
    .replace(/\/\s*ногу\b/gi, ' на каждую ногу')
    .replace(/\/\s*сторону\b/gi, ' на каждую сторону')

const perSideLabel = (exercise: WorkoutExercise) => {
  const side = exercise.perSide ?? getDefinition(exercise.exerciseId)?.perSide
  return side === 'arm' ? 'на каждую руку' :
    side === 'leg' ? 'на каждую ногу' :
    side === 'side' ? 'на каждую сторону' : ''
}

const exerciseDisplayName = (exercise: WorkoutExercise) => {
  const suffix = perSideLabel(exercise)
  return suffix ? `${exercise.name} · ${suffix}` : exercise.name
}

const isWarmupExercise = (exercise: WorkoutExercise) =>
  /размин/i.test(exercise.category) ||
  (exercise.sets.length > 0 && exercise.sets.every((set) => set.setType === 'warmup'))

const isLegacyNewBadge = (badge?: string) => Boolean(badge && /нов(ая|ое|ый)|new/i.test(badge))


function personalExerciseLibrary() {
  const profiles = loadExerciseProfiles()
  const merged = EXERCISE_LIBRARY.map((definition) => mergeDefinitionWithProfile(definition, profiles[definition.id]))
  const staticIds = new Set(merged.map((definition) => definition.id))
  const learnedOnly = Object.values(profiles)
    .filter((profile) => !staticIds.has(profile.exerciseId))
    .map(profileToDefinition)
  return [...merged, ...learnedOnly]
}

function ExerciseVisual({ exercise, compact = false }: { exercise: WorkoutExercise; compact?: boolean }) {
  const def = getDefinition(exercise.exerciseId)
  const image = exerciseImageForDefinition(def) || exercise.image
  if (image) {
    const lower = image.toLowerCase()
    const generated = lower.includes('/exercises-generated/')
    const vector = lower.includes('/exercises-hq/') || lower.endsWith('.svg') || lower.startsWith('data:image/svg+xml')
    const mediaClass = generated ? ' exercise-generated' : vector ? ' exercise-vector' : ''
    const className = compact
      ? `exercise-thumb${mediaClass}`
      : `exercise-image${mediaClass}`
    return <img className={className} src={image} alt={exerciseDisplayName(exercise)} loading={compact ? 'lazy' : 'eager'} />
  }
  return (
    <div className={compact ? 'exercise-thumb exercise-thumb-placeholder' : 'exercise-visual'} aria-label="Изображение упражнения пока не добавлено">
      {!compact && <div className="visual-dumbbell"><i /><b /><i /></div>}
      <strong>{def?.icon ?? exercise.name.slice(0, 3).toUpperCase()}</strong>
      {!compact && <span>{exercise.muscleGroup || exercise.movementPattern}</span>}
    </div>
  )
}

function SetRow({ set, rehab, weightUnit = 'kg', onChange, onCredit }: { set: WorkoutSet; rehab: boolean; weightUnit?: 'kg' | 'lb'; onChange: (patch: Partial<WorkoutSet>) => void; onCredit: () => void }) {
  const setLabel = set.isExtra ? `Дополнительный ${set.setNo}` : set.setType === 'working' ? `Рабочий ${set.setNo}` : set.setType === 'warmup' ? 'Разминка' : set.setType === 'calibration' ? 'Калибровка' : `Подход ${set.setNo}`
  const unit = weightUnit === 'lb' ? 'lbs' : 'кг'
  return (
    <div className={`plan-fact-set ${set.completed ? 'is-complete' : ''}`} id={`set-${set.id}`}>
      <div className="pf-set-title">
        <b>{setLabel}</b>
        {set.completed && <span>✓ засчитан</span>}
      </div>
      <div className="pf-grid pf-head">
        <span />
        <span>Вес <small>{unit}</small></span>
        <span>Повторы</span>
        <span>RIR</span>
        <span>Боль</span>
      </div>
      <div className="pf-grid pf-plan">
        <b>План</b>
        <span>{set.targetWeight || '—'}</span>
        <span>{cleanReps(set.targetReps) || '—'}</span>
        <span>{set.targetRir || '—'}</span>
        <span>{set.targetPain || (rehab ? '≤2' : '—')}</span>
      </div>
      <div className="pf-grid pf-fact">
        <b>Факт</b>
        <input aria-label={`Фактический вес, ${unit}`} inputMode="decimal" value={set.actualWeight} onChange={(e) => onChange({ actualWeight: e.target.value })} placeholder="—" />
        <input aria-label="Фактические повторы" inputMode="decimal" value={cleanReps(set.actualReps)} onChange={(e) => onChange({ actualReps: e.target.value })} placeholder="—" />
        <input aria-label="Фактический RIR" inputMode="decimal" value={set.actualRir} onChange={(e) => onChange({ actualRir: e.target.value })} placeholder="—" />
        <input aria-label="Боль от 0 до 10" inputMode="decimal" value={set.pain} onChange={(e) => onChange({ pain: e.target.value })} placeholder="—" />
      </div>
      <textarea className="comment compact-comment" rows={1} value={set.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Комментарий к подходу — необязательно" />
      <button type="button" className={set.completed ? 'credit-set completed' : 'credit-set'} onClick={onCredit}>
        {set.completed ? 'Засчитан ✓' : 'Засчитать подход'}
      </button>
    </div>
  )
}

function RestBlock({ kind, durationSec, restLeft, exerciseName, nextSetNo, nextExerciseName, onAdd, onAdvance }: {
  kind: 'between_sets' | 'between_exercises'
  durationSec: number
  restLeft: number
  exerciseName: string
  nextSetNo?: number
  nextExerciseName?: string
  onAdd: () => void
  onAdvance: () => void
}) {
  const elapsed = Math.max(0, durationSec - restLeft)
  const progress = durationSec > 0 ? Math.min(1, elapsed / durationSec) : 1
  const ready = restLeft <= 0
  const hue = Math.round(progress * 120)
  const visualProgress = ready ? 100 : Math.round(progress * 1000) / 10
  const restAngle = ready ? 360 : progress * 360
  const nextEyebrow = kind === 'between_sets' ? 'Следующий подход' : 'Следующее упражнение'
  const nextTitle = kind === 'between_sets'
    ? `Подход ${nextSetNo ?? '—'} · ${exerciseName}`
    : nextExerciseName || 'Завершение тренировки'

  return (
    <section
      className={`inline-rest ${kind} ${ready ? 'is-ready' : ''}`}
      style={{ '--rest-hue': hue, '--rest-progress': `${visualProgress}%`, '--rest-angle': `${restAngle}deg` } as CSSProperties & { '--rest-hue': number; '--rest-progress': string; '--rest-angle': string }}
      aria-live="polite"
    >
      <div className="rest-kicker">{kind === 'between_sets' ? 'Отдых между подходами' : 'Отдых между упражнениями'}</div>
      <div className="rest-stage">
        <button
          type="button"
          className="rest-ring"
          aria-label={ready ? 'GO — перейти дальше' : `Осталось ${fmtDuration(restLeft)}`}
          disabled={!ready}
          onClick={ready ? onAdvance : undefined}
        >
          <span className="rest-ring-marker" aria-hidden="true" />
          <div className="rest-ring-inner">
            <strong>{ready ? 'GO!' : fmtDuration(restLeft)}</strong>
          </div>
        </button>

        <div className="rest-meta">
          <div className="rest-next-copy">
            <span>{nextEyebrow}</span>
            <strong>{nextTitle}</strong>
          </div>

          <div className={`rest-actions ${ready ? 'is-ready-placeholder' : ''}`} aria-hidden={ready ? 'true' : undefined}>
            <button type="button" className="rest-secondary" onClick={onAdd} tabIndex={ready ? -1 : 0}>+30 сек</button>
            <button type="button" className="rest-secondary" onClick={onAdvance} tabIndex={ready ? -1 : 0}>Пропустить</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function EndReasonSheet({ title, description, confirmLabel, onClose, onConfirm, reasons = ['Самочувствие', 'Боль / дискомфорт', 'Нет времени', 'Занято', 'Другое'] }: { title: string; description: string; confirmLabel: string; onClose: () => void; onConfirm: (reason: string) => void; reasons?: string[] }) {
  const [reason, setReason] = useState(reasons[0])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet compact-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="eyebrow">ДОСРОЧНОЕ ЗАВЕРШЕНИЕ</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
        <p className="muted">{description}</p>
        <div className="reason-grid">
          {reasons.map((item) => <button key={item} className={reason === item ? 'reason active' : 'reason'} onClick={() => setReason(item)}>{item}</button>)}
        </div>
        <button className="primary big danger-primary" onClick={() => onConfirm(reason)}>{confirmLabel}</button>
        <button className="ghost big" onClick={onClose}>Отмена</button>
      </div>
    </div>
  )
}

function ReplacementSheet({ exercise, onClose, onReplace, onCustom }: { exercise: WorkoutExercise; onClose: () => void; onReplace: (def: ExerciseDefinition, reason: WorkoutExercise['replacementReason']) => void; onCustom: (reason: WorkoutExercise['replacementReason']) => void }) {
  const [reason, setReason] = useState<WorkoutExercise['replacementReason']>('Занято')
  const [query, setQuery] = useState('')
  const library = useMemo(() => personalExerciseLibrary(), [exercise.exerciseId])
  const top = replacementCandidates(exercise, library)
  const needle = query.trim().toLowerCase()
  const all = library.filter((x) => x.id !== exercise.exerciseId && (
    x.name.toLowerCase().includes(needle) ||
    x.muscleGroup.toLowerCase().includes(needle) ||
    x.equipment.toLowerCase().includes(needle) ||
    (x.aliases ?? []).some((alias) => alias.toLowerCase().includes(needle))
  ))
  const options = query ? all : top.slice(0, 10)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="eyebrow">ЗАМЕНА УПРАЖНЕНИЯ</span><h2>{exercise.name}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
        <p className="muted">Исходное упражнение останется в выгрузке. Выбираем только фактическую замену.</p>
        <div className="reason-row">{(['Занято', 'Дискомфорт', 'Другое'] as const).map((x) => <button key={x} className={reason === x ? 'reason active' : 'reason'} onClick={() => setReason(x)}>{x}</button>)}</div>
        <input className="search" placeholder="Найти по всей библиотеке…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="replacement-list">
          {options.map((def) => <button type="button" className={`replacement-item ${def.suitability === 'avoid' ? 'avoid' : def.suitability === 'caution' ? 'caution' : ''}`} key={def.id} onClick={() => onReplace(def, reason)}><img className="replacement-thumb" src={exerciseImageForDefinition(def)} alt="" loading="lazy" /><span><b>{def.name}</b><small>{def.muscleGroup} · {def.movementPattern} · {def.equipment}{def.gym ? ` · ${def.gym}` : ''}</small>{def.lastKnown && <small className="history-mini">Последняя база: {def.lastKnown}</small>}{def.suitability === 'avoid' && <small className="avoid-mini">История: не использовать как обычную замену</small>}{def.suitability === 'caution' && <small className="caution-mini">Есть ограничение / rehab-контекст</small>}</span><span className="chevron">›</span></button>)}
          {!options.length && <div className="empty-mini">Ничего не найдено.</div>}
        </div>
        <button type="button" className="ghost big" onClick={() => onCustom(reason)}>+ Другое упражнение вручную</button>
      </div>
    </div>
  )
}

function MeasuredMorph({ id, open, preview, expanded }: {
  id: string
  open: boolean
  preview: ReactNode
  expanded: ReactNode
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [height, setHeight] = useState<number | undefined>(undefined)

  const measure = () => {
    const node = open ? expandedRef.current : previewRef.current
    if (!node) return
    const nextHeight = Math.ceil(node.getBoundingClientRect().height)
    if (!initialized.current) {
      initialized.current = true
      setHeight(nextHeight)
      return
    }
    window.requestAnimationFrame(() => setHeight(nextHeight))
  }

  useLayoutEffect(() => {
    measure()
  }, [open])

  useEffect(() => {
    const node = open ? expandedRef.current : previewRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(node)
    return () => observer.disconnect()
  }, [open])

  return (
    <div
      id={id}
      className={`exercise-morph-v2 ${open ? 'is-open' : 'is-closed'} ${initialized.current ? 'is-measured' : ''}`}
      style={height === undefined ? undefined : { height }}
    >
      <div ref={previewRef} className="exercise-morph-panel exercise-morph-preview" aria-hidden={open}>
        {preview}
      </div>
      <div ref={expandedRef} className="exercise-morph-panel exercise-morph-expanded" aria-hidden={!open}>
        {expanded}
      </div>
    </div>
  )
}

function NativeCollapse({ id, open, className = '', children }: {
  id?: string
  open: boolean
  className?: string
  children: ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)

  const measureOpenHeight = () => {
    const node = innerRef.current
    if (!node) return
    const nextHeight = Math.ceil(node.getBoundingClientRect().height)
    window.requestAnimationFrame(() => setHeight(nextHeight))
  }

  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      if (open) {
        setHeight(0)
        measureOpenHeight()
      } else {
        setHeight(0)
      }
      return
    }
    if (open) measureOpenHeight()
    else setHeight(0)
  }, [open])

  useEffect(() => {
    if (!open || !innerRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measureOpenHeight())
    observer.observe(innerRef.current)
    return () => observer.disconnect()
  }, [open])

  return (
    <div
      id={id}
      className={`native-collapse ${open ? 'is-open' : 'is-closed'} ${className}`}
      style={{ height: height ?? 'auto' }}
    >
      <div ref={innerRef} className="native-collapse-inner">
        {children}
      </div>
    </div>
  )
}

function WorkoutView({ session, setSession, onExit }: { session: WorkoutSession; setSession: (s: WorkoutSession) => void; onExit: () => void }) {
  const [replacementFor, setReplacementFor] = useState<number | null>(null)
  const [openExercise, setOpenExercise] = useState<string | null>(() => session.plan.exercises.find((exercise) => exercise.startedAt && !exercise.finishedAt)?.instanceId ?? null)
  const [exerciseEnd, setExerciseEnd] = useState<{ index: number; mode: 'early' | 'skip' } | null>(null)
  const [workoutEndOpen, setWorkoutEndOpen] = useState(false)
  const [clock, setClock] = useState(Date.now())
  const [restLeaving, setRestLeaving] = useState(false)
  const [finishGuardHeight, setFinishGuardHeight] = useState(0)
  const transitionTimeout = useRef<number | null>(null)
  const finishRaf = useRef<number | null>(null)
  const history = useMemo(() => loadHistory(), [session.sessionId])
  const exerciseProfiles = useMemo(() => loadExerciseProfiles(), [session.sessionId])
  const [finishedSummary, setFinishedSummary] = useState(Boolean(session.finishedAt))

  useEffect(() => {
    return () => {
      if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current)
      if (finishRaf.current !== null) window.cancelAnimationFrame(finishRaf.current)
    }
  }, [])

  useEffect(() => {
    if (!session.activeRest) return
    const startedAt = new Date(session.activeRest.startedAt).getTime()
    setClock(Number.isFinite(startedAt) ? startedAt : Date.now())
    const t = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [session.activeRest?.startedAt, session.activeRest?.endsAt])

  const restLeft = session.activeRest
    ? Math.min(
        session.activeRest.durationSec,
        Math.max(0, Math.ceil((new Date(session.activeRest.endsAt).getTime() - clock) / 1000))
      )
    : 0

  const totals = useMemo(() => {
    const sets = session.plan.exercises.flatMap((e) => e.sets)
    const done = sets.filter((s) => s.completed)
    const volume = sessionWorkingVolumeKg(session)
    return { totalSets: sets.length, doneSets: done.length, volume, replacements: session.plan.exercises.filter((e) => e.exerciseId !== e.originalExerciseId).length }
  }, [session])

  const mutateExercise = (index: number, fn: (exercise: WorkoutExercise) => WorkoutExercise) => {
    const next = clone(session)
    next.plan.exercises[index] = fn(next.plan.exercises[index])
    next.updatedAt = new Date().toISOString()
    setSession(next)
  }

  const elementTop = (id: string) => document.getElementById(id)?.getBoundingClientRect().top

  const restoreAnchor = (id: string, beforeTop?: number, fallbackTop?: number) => {
    const targetTop = beforeTop ?? fallbackTop
    if (targetTop === undefined) return
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const element = document.getElementById(id)
        if (!element) return
        const delta = element.getBoundingClientRect().top - targetTop
        if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: 'auto' })
      })
    })
  }

  const animateScrollToY = (destination: number, duration = 1120) => {
    if (finishRaf.current !== null) window.cancelAnimationFrame(finishRaf.current)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const startY = window.scrollY
    const targetY = Math.max(0, destination)
    const started = performance.now()

    const frame = (now: number) => {
      const raw = reduceMotion ? 1 : Math.min(1, (now - started) / duration)
      const eased = raw < .5
        ? 8 * Math.pow(raw, 4)
        : 1 - Math.pow(-2 * raw + 2, 4) / 2

      window.scrollTo(0, startY + (targetY - startY) * eased)

      if (raw < 1) finishRaf.current = window.requestAnimationFrame(frame)
      else finishRaf.current = null
    }

    finishRaf.current = window.requestAnimationFrame(frame)
  }

  const smoothScrollToStableElement = (id: string, headerOffset = 88) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(id)
        if (!target) return
        const destination = Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerOffset)
        window.scrollTo({ top: destination, left: 0, behavior: 'smooth' })
      })
    })
  }

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => mutateExercise(exerciseIndex, (exercise) => {
    exercise.sets[setIndex] = { ...exercise.sets[setIndex], ...patch, actualReps: patch.actualReps !== undefined ? cleanReps(patch.actualReps) : exercise.sets[setIndex].actualReps }
    return exercise
  })

  const exerciseRestSeconds = (exercise: WorkoutExercise) =>
    exercise.restAfterExerciseSec ?? Math.max(90, exercise.sets[exercise.sets.length - 1]?.restSec ?? 90)

  const putRest = (draft: WorkoutSession, kind: 'between_sets' | 'between_exercises', durationSec: number, exerciseIndex: number, nextSetNo?: number) => {
    const exercise = draft.plan.exercises[exerciseIndex]
    const nextExercise = draft.plan.exercises.slice(exerciseIndex + 1).find((item) => !item.finishedAt)
    const normalizedDuration = Math.max(1, Math.round(Number(durationSec) || 90))
    const now = Date.now()

    // A new recovery period is always a brand-new timer.
    // Never carry remaining time or a previous +30 sec extension into the next rest.
    delete draft.activeRest
    draft.activeRest = {
      kind,
      durationSec: normalizedDuration,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + normalizedDuration * 1000).toISOString(),
      exerciseIndex,
      exerciseName: exercise.name,
      nextSetNo,
      nextExerciseName: nextExercise?.name
    }
    return now
  }

  const creditSet = (exerciseIndex: number, setIndex: number) => {
    const anchorId = `set-${session.plan.exercises[exerciseIndex].sets[setIndex].id}`
    const anchorTop = elementTop(anchorId)

    const next = clone(session)
    const exercise = next.plan.exercises[exerciseIndex]
    const set = exercise.sets[setIndex]
    const completed = !set.completed
    set.completed = completed
    set.completedAt = completed ? new Date().toISOString() : undefined

    let restStartedAt: number | undefined
    if (completed) {
      const nextPending = exercise.sets.find((candidate, index) => index !== setIndex && !candidate.completed)
      if (nextPending) {
        restStartedAt = putRest(next, 'between_sets', set.restSec || 90, exerciseIndex, nextPending.setNo)
      } else {
        restStartedAt = putRest(next, 'between_exercises', exerciseRestSeconds(exercise), exerciseIndex)
      }
    } else if (next.activeRest?.exerciseIndex === exerciseIndex) {
      delete next.activeRest
    }

    next.updatedAt = new Date().toISOString()
    setSession(next)
    if (restStartedAt !== undefined) setClock(restStartedAt)

    // If the old timer was above this set and the new one appears below it,
    // keep the set under the user's finger instead of letting the page jump.
    restoreAnchor(anchorId, anchorTop)
  }

  const addExtraSet = (exerciseIndex: number) => {
    const current = session.plan.exercises[exerciseIndex]
    const currentSource = current.sets[current.sets.length - 1]
    const anchorId = currentSource ? `set-${currentSource.id}` : `exercise-${current.instanceId}`
    const anchorTop = elementTop(anchorId)

    const next = clone(session)
    const exercise = next.plan.exercises[exerciseIndex]
    const source = exercise.sets[exercise.sets.length - 1]
    if (!source) return
    const setNo = Math.max(...exercise.sets.map((item) => item.setNo), 0) + 1
    const extra: WorkoutSet = {
      ...clone(source),
      id: `${exercise.exerciseId}-extra-${setNo}-${Date.now()}`,
      setNo,
      isExtra: true,
      copiedFromSetNo: source.setNo,
      completed: false,
      completedAt: undefined
    }
    exercise.sets.push(extra)
    exercise.finishedAt = undefined
    exercise.finishMode = undefined
    exercise.finishReason = undefined
    const restStartedAt = putRest(next, 'between_sets', source.restSec || 90, exerciseIndex, setNo)
    next.updatedAt = new Date().toISOString()
    setSession(next)
    setClock(restStartedAt)
    setOpenExercise(exercise.instanceId)
    restoreAnchor(anchorId, anchorTop)
  }

  const openExerciseAt = (index: number) => {
    const exercise = session.plan.exercises[index]
    if (!exercise.startedAt) {
      mutateExercise(index, (draft) => ({ ...draft, startedAt: new Date().toISOString() }))
    }
    setOpenExercise(exercise.instanceId)
  }

  const closeExercise = (index: number, mode: 'completed' | 'early' | 'skipped', reason = '') => {
    const sourceExercise = session.plan.exercises[index]
    const morph = document.getElementById(`exercise-${sourceExercise.instanceId}`)
    const preview = morph?.querySelector('.exercise-morph-preview') as HTMLElement | null

    const morphRect = morph?.getBoundingClientRect()
    const expandedHeight = morphRect?.height ?? 0
    const compactHeight = preview?.getBoundingClientRect().height ?? 0
    const collapseDelta = Math.max(0, expandedHeight - compactHeight)

    // Keep enough invisible document height during the collapse so iOS Safari
    // never clamps scrollY while a multi-screen exercise becomes a ~100 px row.
    const guardHeight = collapseDelta + Math.round(window.innerHeight * 0.45)
    if (guardHeight > 0) setFinishGuardHeight(guardHeight)

    const next = clone(session)
    const exercise = next.plan.exercises[index]
    const now = new Date().toISOString()
    exercise.finishedAt = now
    exercise.finishMode = mode
    exercise.finishReason = reason || undefined
    exercise.skippedAt = mode === 'skipped' ? now : undefined

    const timerAlreadyRunning = next.activeRest?.kind === 'between_exercises' && next.activeRest.exerciseIndex === index
    let restStartedAt: number | undefined
    if (!timerAlreadyRunning || mode !== 'completed') {
      restStartedAt = putRest(next, 'between_exercises', exerciseRestSeconds(exercise), index)
    }

    next.updatedAt = now
    setRestLeaving(false)
    setSession(next)
    if (restStartedAt !== undefined) setClock(restStartedAt)
    setOpenExercise(null)
    setExerciseEnd(null)

    if (morphRect) {
      const morphAbsoluteTop = window.scrollY + morphRect.top
      const finalBoundaryTop = morphAbsoluteTop + compactHeight

      // Finish with the rest block comfortably below the sticky header.
      // Destination is computed BEFORE the DOM changes, so it never chases a
      // moving element and cannot overshoot.
      const desiredTimerTop = 188
      const destination = Math.max(0, finalBoundaryTop - desiredTimerTop)
      animateScrollToY(destination, 1120)
    }

    if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current)
    transitionTimeout.current = window.setTimeout(() => {
      transitionTimeout.current = null

      // The morph is now finished. Removing a bottom-only guard does not move
      // any workout content; only protect against a final Safari max-scroll clamp.
      const pageHeight = document.documentElement.scrollHeight
      const maxWithoutGuard = Math.max(0, pageHeight - guardHeight - window.innerHeight)
      if (guardHeight > 0 && window.scrollY > maxWithoutGuard) {
        animateScrollToY(maxWithoutGuard, 360)
        window.setTimeout(() => setFinishGuardHeight(0), 390)
      } else {
        setFinishGuardHeight(0)
      }
    }, 1180)
  }

  const requestFinishExercise = (index: number) => {
    const exercise = session.plan.exercises[index]
    const allCompleted = exercise.sets.every((set) => set.completed)
    if (allCompleted) closeExercise(index, 'completed')
    else setExerciseEnd({ index, mode: 'early' })
  }

  const requestSkipExercise = (index: number) => setExerciseEnd({ index, mode: 'skip' })

  const advanceFromRest = () => {
    if (!session.activeRest || restLeaving) return

    const rest = session.activeRest
    const current = session.plan.exercises[rest.exerciseIndex]
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()

    const staged = clone(session)
    staged.updatedAt = new Date().toISOString()

    let targetId = ''
    if (rest.kind === 'between_sets') {
      const target = current.sets.find((set) => set.setNo === rest.nextSetNo && !set.completed)
      targetId = target ? `set-${target.id}` : `exercise-${current.instanceId}`
      setOpenExercise(current.instanceId)
    } else {
      const nextIndex = staged.plan.exercises.findIndex((exercise, index) => index > rest.exerciseIndex && !exercise.finishedAt)
      if (nextIndex >= 0) {
        const exercise = staged.plan.exercises[nextIndex]
        exercise.startedAt = exercise.startedAt ?? new Date().toISOString()
        targetId = `exercise-${exercise.instanceId}`
        setOpenExercise(exercise.instanceId)
      } else {
        targetId = 'workout-summary'
      }
    }

    setRestLeaving(true)
    setSession(staged)

    if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current)
    transitionTimeout.current = window.setTimeout(() => {
      transitionTimeout.current = null

      // At this point the timer is already height: 0 and the destination card
      // has completed its measured-height morph. Removing the zero-height shell
      // cannot change layout, so there is no intermediate jump.
      const finalState = clone(staged)
      delete finalState.activeRest
      finalState.updatedAt = new Date().toISOString()
      setSession(finalState)
      setClock(Date.now())
      setRestLeaving(false)

      smoothScrollToStableElement(targetId)
    }, 1160)
  }

  const addRestTime = (seconds: number) => {
    if (!session.activeRest) return
    const next = clone(session)
    const base = Math.max(Date.now(), new Date(next.activeRest!.endsAt).getTime())
    next.activeRest!.endsAt = new Date(base + seconds * 1000).toISOString()
    next.activeRest!.durationSec += seconds
    next.updatedAt = new Date().toISOString()
    setSession(next)
    setClock(Date.now())
  }

  const replaceExercise = (index: number, def: ExerciseDefinition, reason: WorkoutExercise['replacementReason']) => {
    mutateExercise(index, (exercise) => {
      const originalSnapshot = exercise.originalSnapshot ?? {
        exerciseId: exercise.exerciseId,
        category: exercise.category,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        movementPattern: exercise.movementPattern,
        equipment: exercise.equipment,
        rehab: exercise.rehab,
        instruction: exercise.instruction,
        image: exercise.image,
        badge: exercise.badge,
        perSide: exercise.perSide,
        weightUnit: exercise.weightUnit
      }
      return {
        ...exercise,
        originalSnapshot,
        exerciseId: def.id,
        name: def.name,
        category: def.category,
        muscleGroup: def.muscleGroup,
        movementPattern: def.movementPattern,
        equipment: def.equipment,
        rehab: Boolean(def.rehab),
        instruction: def.instruction || `Замена на ${def.name}. Вес и фактические повторения внеси по ходу тренировки.`,
        image: undefined,
        badge: 'Замена',
        perSide: def.perSide,
        weightUnit: def.weightUnit ?? exercise.weightUnit ?? 'kg',
        startedAt: exercise.startedAt ?? new Date().toISOString(),
        finishedAt: undefined,
        replacementReason: reason,
        replacedAt: new Date().toISOString(),
        sets: exercise.sets.map((s, i) => ({ ...s, id: `${def.id}-${i + 1}-${Date.now()}`, targetWeight: '', targetReps: def.defaultReps || cleanReps(s.targetReps), actualWeight: '', actualReps: '', actualRir: '', pain: '', comment: '', completed: false, completedAt: undefined }))
      }
    })
    setReplacementFor(null)
  }

  const replaceCustom = (index: number, reason: WorkoutExercise['replacementReason']) => {
    const source = session.plan.exercises[index]
    const name = window.prompt('Название упражнения')?.trim()
    if (!source || !name) return
    replaceExercise(index, {
      id: `custom-${id()}`,
      name,
      category: source.category,
      muscleGroup: source.muscleGroup,
      movementPattern: source.movementPattern,
      equipment: 'Другое',
      rehab: source.rehab,
      icon: 'NEW'
    }, reason)
  }

  const undoReplacement = (index: number) => {
    mutateExercise(index, (exercise) => {
      const snapshot = exercise.originalSnapshot
      const def = getDefinition(exercise.originalExerciseId)
      return {
        ...exercise,
        exerciseId: snapshot?.exerciseId || exercise.originalExerciseId,
        name: snapshot?.name || exercise.originalName,
        category: snapshot?.category || def?.category || exercise.category,
        muscleGroup: snapshot?.muscleGroup || def?.muscleGroup || exercise.muscleGroup,
        movementPattern: snapshot?.movementPattern || def?.movementPattern || exercise.movementPattern,
        equipment: snapshot?.equipment || def?.equipment || exercise.equipment,
        rehab: snapshot?.rehab ?? Boolean(def?.rehab),
        image: snapshot?.image,
        replacementReason: undefined,
        replacedAt: undefined,
        badge: snapshot?.badge ?? def?.badge,
        perSide: snapshot?.perSide ?? def?.perSide,
        weightUnit: snapshot?.weightUnit ?? def?.weightUnit ?? exercise.weightUnit ?? 'kg',
        instruction: snapshot?.instruction || def?.instruction || exercise.instruction,
        sets: exercise.sets.map((s) => ({ ...s, actualWeight: s.targetWeight, actualReps: s.targetReps, actualRir: '', pain: '', comment: '', completed: false, completedAt: undefined }))
      }
    })
  }

  const finalizeWorkout = (mode: 'completed' | 'early', reason = '') => {
    const next = clone(session)
    next.finishedAt = next.finishedAt ?? new Date().toISOString()
    next.finishMode = mode
    next.finishReason = reason || undefined
    next.updatedAt = new Date().toISOString()
    delete next.activeRest
    setSession(next)
    archiveSession(next)
    setWorkoutEndOpen(false)
    setFinishedSummary(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  const requestFinishWorkout = () => {
    const allExercisesClosed = session.plan.exercises.every((exercise) => Boolean(exercise.finishedAt))
    if (allExercisesClosed) finalizeWorkout('completed')
    else setWorkoutEndOpen(true)
  }

  if (finishedSummary) {
    const end = session.finishedAt ? new Date(session.finishedAt) : new Date()
    const duration = Math.max(0, Math.round((end.getTime() - new Date(session.startedAt).getTime()) / 60000))
    return <main className="app-shell"><header className="topbar"><button className="back" onClick={onExit}>‹</button><span>FitProgress</span><span className="status-dot">сохранено</span></header><section className="summary-card"><span className="pill">Тренировка завершена</span><h1>{session.plan.title}</h1><p>{fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}–{fmtTime(end.toISOString())}</p><div className="summary-grid"><div><b>{session.plan.exercises.length}</b><span>упражнений</span></div><div><b>{totals.doneSets}/{totals.totalSets}</b><span>подходов</span></div><div><b>{duration}</b><span>минут</span></div><div><b>{totals.replacements}</b><span>замен</span></div></div><button className="primary big" onClick={() => exportSession(session)}>Выгрузить эту тренировку</button><button className="secondary big" onClick={exportFullRegistry}>Выгрузить полный реестр</button><button className="secondary big" onClick={() => setFinishedSummary(false)}>Вернуться к тренировке</button><button className="ghost big" onClick={onExit}>На главный экран</button></section></main>
  }

  return (
    <main className="app-shell workout-page">
      <header className="topbar sticky"><button className="back" onClick={onExit}>‹</button><span>FitProgress</span><button className="top-finish" onClick={requestFinishWorkout}>Завершить</button></header>
      <section className="hero-card">
        <span className="pill">Тренировка · {fmtDate(session.startedAt)}</span>
        <h1>{session.plan.title}</h1>
        {session.plan.priority && <p className="priority">{session.plan.priority}</p>}
        <div className="hero-stats"><div><span>Начало</span><b>{fmtTime(session.startedAt)}</b></div><div><span>Упражнения</span><b>{session.plan.exercises.length}</b></div><div><span>Подходы</span><b>{totals.doneSets}/{totals.totalSets}</b></div></div>
        {session.plan.notes && <p className="hero-note">{session.plan.notes}</p>}
      </section>

      <div className="progress-track"><div style={{ width: `${totals.totalSets ? (totals.doneSets / totals.totalSets) * 100 : 0}%` }} /></div>

      <section className="exercise-list" aria-label="Упражнения тренировки">
        {session.plan.exercises.map((exercise, exerciseIndex) => {
          const isOpen = openExercise === exercise.instanceId
          const staticDefinition = getDefinition(exercise.exerciseId)
          const definition = staticDefinition
            ? mergeDefinitionWithProfile(staticDefinition, exerciseProfiles[exercise.exerciseId])
            : exerciseProfiles[exercise.exerciseId]
              ? profileToDefinition(exerciseProfiles[exercise.exerciseId])
              : undefined
          const doneSets = exercise.sets.filter((set) => set.completed).length
          const representative = exercise.sets.find((set) => set.setType === 'working') ?? exercise.sets[exercise.sets.length - 1]
          const hasLocalHistory = history.some((past) => past.plan.exercises.some((pastExercise) => pastExercise.exerciseId === exercise.exerciseId || pastExercise.originalExerciseId === exercise.exerciseId))
          const isNew = !(definition?.known || exerciseProfiles[exercise.exerciseId] || hasLocalHistory)
          const previewNode = (
              <button type="button" className={`exercise-preview-row ${exercise.finishedAt ? 'is-finished' : ''}`} key={exercise.instanceId} tabIndex={isOpen ? -1 : 0} onClick={() => openExerciseAt(exerciseIndex)}>
                <ExerciseVisual exercise={exercise} compact />
                <div className="preview-copy">
                  <span className="eyebrow">{String(exercise.order).padStart(2, '0')} · {exercise.muscleGroup || exercise.category}</span>
                  <h3>{exerciseDisplayName(exercise)}</h3>
                  <p>{exercise.sets.length} подх.{representative ? ` · ${representative.targetWeight || '—'} ${exercise.weightUnit === 'lb' ? 'lbs' : 'кг'} × ${cleanReps(representative.targetReps) || '—'}` : ''}</p>
                  <div className="preview-tags">
                    {exercise.equipment && <span>{exercise.equipment}</span>}
                    {exercise.rehab && <span>Rehab</span>}
                    {definition?.known && <span className="known">Есть история</span>}
                    {isNew && <span className="new">Новое</span>}
                    {exercise.finishedAt && <span className="done">Готово ✓</span>}
                    {!exercise.finishedAt && doneSets > 0 && <span>{doneSets}/{exercise.sets.length}</span>}
                    {!exercise.finishedAt && exercise.sets.length > 0 && exercise.sets.every((set) => set.completed) && <span className="ready-finish">План выполнен · завершить</span>}
                  </div>
                </div>
                <span className="row-chevron">›</span>
              </button>
          )

          const expandedNode = (
            <section className="exercise-expanded" key={exercise.instanceId}>
              <button className="collapse-control" type="button" onClick={() => setOpenExercise(null)}>‹ Все упражнения</button>
              <ExerciseVisual exercise={exercise} />
              <div className="expanded-copy">
                <span className="eyebrow">{String(exercise.order).padStart(2, '0')} · {exercise.category}</span>
                <h2>{exerciseDisplayName(exercise)}</h2>
                <div className="tag-row">
                  {exercise.muscleGroup && <span className="context-tag">{exercise.muscleGroup}</span>}
                  {exercise.equipment && <span className="context-tag">{exercise.equipment}</span>}
                  <span className="context-tag">{exercise.weightUnit === 'lb' ? 'lbs' : 'кг'}</span>
                  {exercise.rehab && <span className="context-tag status">Rehab</span>}
                  {isWarmupExercise(exercise) && <span className="context-tag status">Разминка</span>}
                  {definition?.known && <span className="context-tag known">{exerciseProfiles[exercise.exerciseId] ? 'Есть история' : 'Есть ретро'}</span>}
                  {definition?.suitability === 'caution' && <span className="context-tag caution">Ограничение</span>}
                  {definition?.suitability === 'avoid' && <span className="context-tag avoid">Не использовать</span>}
                  {isNew && <span className="context-tag new">Новое</span>}
                  {exercise.exerciseId !== exercise.originalExerciseId && <span className="context-tag replacement">Замена</span>}
                </div>
                {exercise.instruction && <p className="instruction">{humanizeInstruction(exercise.instruction)}</p>}
                {definition?.known && (definition.lastKnown || definition.bestKnown || definition.historyNote || definition.lastPain) && <div className={`history-card ${definition.suitability === 'avoid' ? 'avoid' : definition.suitability === 'caution' ? 'caution' : ''}`}>
                  <div className="history-card-head"><b>Накопленная база</b>{definition.gym && <span>{definition.gym}</span>}</div>
                  <div className="history-values">
                    {definition.lastKnown && <div><span>Последняя база</span><b>{definition.lastKnown}</b></div>}
                    {definition.bestKnown && <div><span>Лучший результат</span><b>{definition.bestKnown}</b></div>}
                    {exerciseProfiles[exercise.exerciseId]?.lastRir && <div><span>Последний RIR</span><b>{exerciseProfiles[exercise.exerciseId].lastRir}</b></div>}
                    {definition.lastPain && <div><span>Боль</span><b>{definition.lastPain}/10</b></div>}
                  </div>
                  {exerciseProfiles[exercise.exerciseId] && <div className="learned-meta">Последняя тренировка: {fmtDate(exerciseProfiles[exercise.exerciseId].lastPerformedAt)} · записей: {exerciseProfiles[exercise.exerciseId].sessions}</div>}
                  {definition.historyNote && <p>{definition.historyNote}</p>}
                  {definition.suitability === 'avoid' && <strong className="history-warning">Не использовать как обычную замену без отдельного решения.</strong>}
                  {definition.suitability === 'caution' && <strong className="history-caution">Есть ограничение: ориентируйся на указанную механику и фактические ощущения.</strong>}
                </div>}
              </div>

              {exercise.exerciseId !== exercise.originalExerciseId && <div className="replacement-banner"><span>↔ План: <b>{exercise.originalName}</b><br />Факт: <b>{exercise.name}</b>{exercise.replacementReason ? ` · ${exercise.replacementReason}` : ''}</span><button onClick={() => undoReplacement(exerciseIndex)}>Вернуть исходное</button></div>}

              <div className="expanded-actions">
                <button className="secondary" onClick={() => setReplacementFor(exerciseIndex)}>↔ Заменить упражнение</button>
              </div>

              <div className="plan-fact-title">
                <b>План / факт</b>
                <span>Вес в {exercise.weightUnit === 'lb' ? 'lbs' : 'кг'}</span>
              </div>
              <div className="sets-stack">
                {exercise.sets.map((set, setIndex) => (
                  <Fragment key={set.id}>
                    {session.activeRest?.kind === 'between_sets' &&
                      session.activeRest.exerciseIndex === exerciseIndex &&
                      session.activeRest.nextSetNo === set.setNo && (
                        <NativeCollapse
                          id={`rest-set-${exerciseIndex}-${set.setNo}`}
                          open={!restLeaving}
                          className="rest-native-collapse"
                        >
                          <RestBlock
                            kind="between_sets"
                            durationSec={session.activeRest.durationSec}
                            restLeft={restLeft}
                            exerciseName={session.activeRest.exerciseName}
                            nextSetNo={session.activeRest.nextSetNo}
                            nextExerciseName={session.activeRest.nextExerciseName}
                            onAdd={() => addRestTime(30)}
                            onAdvance={advanceFromRest}
                          />
                        </NativeCollapse>
                      )}
                    <SetRow set={set} rehab={exercise.rehab} weightUnit={exercise.weightUnit ?? 'kg'} onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)} onCredit={() => creditSet(exerciseIndex, setIndex)} />
                  </Fragment>
                ))}
              </div>

              {(() => {
                const plannedDone = exercise.sets.filter((set) => !set.isExtra).every((set) => set.completed)
                const allDone = exercise.sets.every((set) => set.completed)
                return <div className="exercise-close-actions">
                  {plannedDone && allDone && <button className="secondary big add-set" type="button" onClick={() => addExtraSet(exerciseIndex)}>＋ Добавить подход</button>}
                  <button id={`finish-exercise-${exerciseIndex}`} className={allDone ? 'primary big finish-exercise' : 'secondary big finish-exercise'} type="button" onClick={() => requestFinishExercise(exerciseIndex)}>
                    {allDone ? 'Завершить упражнение' : 'Завершить досрочно'}
                  </button>
                  <button className="ghost big skip-exercise" type="button" onClick={() => requestSkipExercise(exerciseIndex)}>Пропустить упражнение</button>
                </div>
              })()}
            </section>
          )

          const exerciseNode = (
            <MeasuredMorph
              id={`exercise-${exercise.instanceId}`}
              open={isOpen}
              preview={previewNode}
              expanded={expandedNode}
            />
          )

          const showExerciseRest = session.activeRest?.kind === 'between_exercises' && session.activeRest.exerciseIndex === exerciseIndex
          return (
            <Fragment key={exercise.instanceId}>
              {exerciseNode}
              {showExerciseRest && (
                <NativeCollapse
                  id={`rest-exercise-${exerciseIndex}`}
                  open={!restLeaving}
                  className="exercise-rest-slot rest-native-collapse"
                >
                  <RestBlock
                    kind="between_exercises"
                    durationSec={session.activeRest!.durationSec}
                    restLeft={restLeft}
                    exerciseName={session.activeRest!.exerciseName}
                    nextSetNo={session.activeRest!.nextSetNo}
                    nextExerciseName={session.activeRest!.nextExerciseName}
                    onAdd={() => addRestTime(30)}
                    onAdvance={advanceFromRest}
                  />
                </NativeCollapse>
              )}
            </Fragment>
          )
        })}
      </section>

      <div className="finish-scroll-guard" style={{ height: finishGuardHeight }} aria-hidden="true" />

      <section id="workout-summary" className="finish-card"><h2>Итог тренировки</h2><div className="summary-grid"><div><b>{session.plan.exercises.length}</b><span>упражнений</span></div><div><b>{totals.doneSets}/{totals.totalSets}</b><span>подходов</span></div><div><b>{totals.replacements}</b><span>замен</span></div><div><b>{totals.volume ? Math.round(totals.volume).toLocaleString('ru-RU') : '—'}</b><span>тоннаж, кг*</span></div></div><small>* Только завершённые рабочие/дополнительные подходы с точным весом и повторами; lb переводятся в кг, односторонние упражнения и парные гантели учитываются по фактической работе. Разминка, калибровка, rehab и BW без числового веса не входят.</small><button className="primary big" onClick={requestFinishWorkout}>{session.plan.exercises.every((exercise) => Boolean(exercise.finishedAt)) ? 'Завершить тренировку' : 'Завершить тренировку досрочно'}</button><button className="secondary big" onClick={() => exportSession(session)}>Выгрузить Excel сейчас</button></section>

      {replacementFor !== null && <ReplacementSheet exercise={session.plan.exercises[replacementFor]} onClose={() => setReplacementFor(null)} onReplace={(def, reason) => replaceExercise(replacementFor, def, reason)} onCustom={(reason) => replaceCustom(replacementFor, reason)} />}
      {exerciseEnd && <EndReasonSheet
        title={exerciseEnd.mode === 'skip' ? 'Пропустить упражнение?' : 'Завершить упражнение досрочно?'}
        description={exerciseEnd.mode === 'skip'
          ? 'Упражнение будет помечено как пропущенное. Уже внесённые данные останутся в истории.'
          : 'Выполненные подходы сохранятся, оставшиеся останутся невыполненными.'}
        confirmLabel={exerciseEnd.mode === 'skip' ? 'Пропустить упражнение' : 'Завершить досрочно'}
        onClose={() => setExerciseEnd(null)}
        onConfirm={(reason) => closeExercise(exerciseEnd.index, exerciseEnd.mode === 'skip' ? 'skipped' : 'early', reason)}
      />}
      {workoutEndOpen && <EndReasonSheet
        title="Завершить тренировку досрочно?"
        description="Все уже внесённые подходы сохранятся. Незакрытые упражнения останутся невыполненными в Excel."
        confirmLabel="Завершить тренировку"
        reasons={['Самочувствие', 'Боль / дискомфорт', 'Нет времени', 'Другое']}
        onClose={() => setWorkoutEndOpen(false)}
        onConfirm={(reason) => finalizeWorkout('early', reason)}
      />}
    </main>
  )
}

function PlanPreview({ plan, onBegin, onBack }: { plan: WorkoutPlan; onBegin: () => void; onBack: () => void }) {
  const totalSets = plan.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const workingSets = plan.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.setType === 'working').length, 0)

  return (
    <main className="app-shell home-page">
      <header className="topbar"><button className="back" onClick={onBack}>‹</button><span>FitProgress</span><span className="status-dot">план загружен</span></header>
      <section className="summary-card plan-preview">
        <span className="pill">Готово к тренировке</span>
        <h1>{plan.title}</h1>
        {plan.priority && <p className="priority">{plan.priority}</p>}
        <div className="summary-grid">
          <div><b>{plan.exercises.length}</b><span>упражнений</span></div>
          <div><b>{totalSets}</b><span>подходов</span></div>
          <div><b>{workingSets}</b><span>рабочих</span></div>
          <div><b>—</b><span>дата старта</span></div>
        </div>
        <p className="preview-note">Дата и время запишутся только после нажатия «Начать тренировку». Поэтому программу можно импортировать заранее — длительность тренировки не исказится.</p>
        <div className="preview-exercises">
          {plan.exercises.map((exercise) => (
            <div className="preview-row" key={exercise.instanceId}>
              <span>{String(exercise.order).padStart(2, '0')}</span>
              <div><b>{exerciseDisplayName(exercise)}</b><small>{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''} · {exercise.sets.length} подх.</small></div>
            </div>
          ))}
        </div>
        <button className="primary big" onClick={onBegin}>Начать тренировку</button>
        <button className="ghost big" onClick={onBack}>Назад</button>
      </section>
    </main>
  )
}

function ExerciseLibraryView({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'current' | 'all' | 'rehab'>('current')
  const profiles = loadExerciseProfiles()
  const library = personalExerciseLibrary()
  const needle = query.trim().toLowerCase()
  const items = library
    .filter((exercise) => exercise.known)
    .filter((exercise) => scope === 'all' ? true : scope === 'rehab' ? Boolean(exercise.rehab) : exercise.gym !== 'Старый зал')
    .filter((exercise) => !needle || [exercise.name, exercise.muscleGroup, exercise.equipment, ...(exercise.aliases ?? [])].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (a.suitability === 'avoid' && b.suitability !== 'avoid') return 1
      if (b.suitability === 'avoid' && a.suitability !== 'avoid') return -1
      return a.muscleGroup.localeCompare(b.muscleGroup, 'ru') || a.name.localeCompare(b.name, 'ru')
    })

  const currentCount = library.filter((x) => x.known && x.gym === 'Новый зал').length
  const legacyCount = library.filter((x) => x.known && x.gym === 'Старый зал').length
  const rehabCount = library.filter((x) => x.known && x.rehab).length

  return (
    <main className="app-shell library-page">
      <header className="topbar sticky"><button className="back" onClick={onBack}>‹</button><span>База упражнений</span><span className="status-dot">{currentCount + legacyCount} известных</span></header>
      <section className="library-hero">
        <span className="pill">Персональная база</span>
        <h1>Накопленный опыт уже внутри FitProgress.</h1>
        <p>Текущие и старые упражнения, рабочие веса, лучшие результаты и rehab-контекст используются для тегов «Новое» и при подборе замен.</p>
        <div className="library-stats"><div><b>{currentCount}</b><span>текущий зал</span></div><div><b>{legacyCount}</b><span>старый зал</span></div><div><b>{rehabCount}</b><span>rehab</span></div></div>
      </section>
      <section className="shoulder-profile">
        <div className="shoulder-profile-head">
          <div>
            <span className="eyebrow">ПЛЕЧО · ОБНОВЛЕНО {SHOULDER_PROFILE.updatedAt}</span>
            <h2>{SHOULDER_PROFILE.phase}</h2>
            <p>{SHOULDER_PROFILE.summary}</p>
          </div>
          <span className="shoulder-phase">{SHOULDER_PROFILE.focus}</span>
        </div>
        <div className="shoulder-checkpoints">
          {SHOULDER_PROFILE.checkpoints.map((item) => (
            <div className={`shoulder-check ${item.status}`} key={item.id}>
              <div><b>{item.name}</b><span>{item.value}</span></div>
              <div className="shoulder-pain">{item.pain}</div>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
        <div className="shoulder-next"><b>Следующий ориентир</b><p>{SHOULDER_PROFILE.nextGoal}</p><strong>{SHOULDER_PROFILE.guardrail}</strong></div>
      </section>
      <input className="search library-search" placeholder="Поиск: спина, Matrix, жим, бицепс…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="library-tabs">
        <button className={scope === 'current' ? 'active' : ''} onClick={() => setScope('current')}>Текущий зал</button>
        <button className={scope === 'rehab' ? 'active' : ''} onClick={() => setScope('rehab')}>Rehab</button>
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Вся история</button>
      </div>
      <section className="library-list">
        {items.map((exercise) => (
          <article className={`library-item ${exercise.suitability === 'avoid' ? 'avoid' : exercise.suitability === 'caution' ? 'caution' : ''}`} key={exercise.id}>
            <div className="library-item-visual"><img src={exerciseImageForDefinition(exercise)} alt={exercise.name} loading="lazy" /></div>
            <div className="library-item-head">
              <div><span className="eyebrow">{exercise.muscleGroup} · {exercise.equipment}</span><h2>{exercise.name}</h2></div>
              <div className="library-badges">
                {exercise.gym && <span>{exercise.gym}</span>}
                {profiles[exercise.id] && <span className="learned">Обновлено тренировкой</span>}
                {exercise.rehab && <span className="rehab">Rehab</span>}
                {exercise.suitability === 'caution' && <span className="caution">Ограничение</span>}
                {exercise.suitability === 'avoid' && <span className="avoid">Не использовать</span>}
              </div>
            </div>
            <div className="library-values">
              {exercise.lastKnown && <div><span>Последняя база</span><b>{exercise.lastKnown}</b></div>}
              {exercise.bestKnown && <div><span>Лучший результат</span><b>{exercise.bestKnown}</b></div>}
              {profiles[exercise.id]?.lastRir && <div><span>Последний RIR</span><b>{profiles[exercise.id].lastRir}</b></div>}
              {exercise.lastPain && <div><span>Боль</span><b>{exercise.lastPain}/10</b></div>}
            </div>
            {profiles[exercise.id] && <div className="learned-profile">
              <div><span>Последняя тренировка</span><b>{fmtDate(profiles[exercise.id].lastPerformedAt)}</b></div>
              <div><span>Тренировок</span><b>{profiles[exercise.id].sessions}</b></div>
              {profiles[exercise.id].lastComment && <p>«{profiles[exercise.id].lastComment}»</p>}
            </div>}
            {exercise.historyNote && <p>{exercise.historyNote}</p>}
          </article>
        ))}
        {!items.length && <div className="empty-mini">Ничего не найдено.</div>}
      </section>
    </main>
  )
}

function Home({ active, onLoadPlan, onResume, onDiscard, onOpenLibrary, onOpenAnalytics }: { active: WorkoutSession | null; onLoadPlan: (plan: WorkoutPlan) => void; onResume: () => void; onDiscard: () => void; onOpenLibrary: () => void; onOpenAnalytics: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const history = loadHistory().slice(0, 3)

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setError('')
      const plan = await importWorkout(file)
      onLoadPlan(plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать Excel.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="app-shell home-page">
      <header className="brand"><div className="brand-mark"><span /><i /><span /></div><div><b>FitProgress</b><small>офлайн-дневник тренировок</small></div></header>
      {active && <section className="resume-card"><span className="pill">Незавершённая тренировка</span><h1>{active.plan.title}</h1><p>{fmtDate(active.startedAt)} · начало {fmtTime(active.startedAt)}</p><div className="resume-actions"><button className="primary" onClick={onResume}>Продолжить</button><button className="ghost" onClick={onDiscard}>Удалить</button></div></section>}
      <section className="home-hero"><span className="pill">MVP · работает офлайн</span><h1>Программа из Excel → удобная тренировка → Excel с фактом.</h1><p>Вес, повторы, RIR, боль, комментарии и замены упражнений сохраняются на телефоне после каждого изменения.</p></section>
      <section className="action-stack">
        <button className="primary huge" onClick={() => fileRef.current?.click()}><span>↑</span><div><b>Импортировать тренировку</b><small>.xlsx по шаблону FitProgress</small></div></button>
        <input ref={fileRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={chooseFile} />
        <button className="secondary huge" onClick={onOpenAnalytics}><span>↗</span><div><b>Аналитика прогресса</b><small>общий объём, рабочие веса и повторы</small></div></button>
        <button className="secondary huge" onClick={onOpenLibrary}><span>≡</span><div><b>База упражнений</b><small>ретро-данные, рабочие веса и rehab-контекст</small></div></button>
        <button className="secondary huge" onClick={exportFullRegistry}><span>↓</span><div><b>Выгрузить полный реестр</b><small>вся ретроспектива + все завершённые тренировки FitProgress</small></div></button><button className="ghost huge" onClick={downloadTemplate}><span>↓</span><div><b>Скачать Excel-шаблон</b><small>этот формат я буду готовить тебе дальше</small></div></button>
      </section>
      {error && <div className="error-box">{error}</div>}
      <section className="offline-card"><b>Без интернета</b><p>После первого полного открытия установленная PWA хранит интерфейс локально. Текущая тренировка — в памяти Safari на устройстве.</p></section>
      {history.length > 0 && <section className="history"><span className="eyebrow">ПОСЛЕДНИЕ ТРЕНИРОВКИ</span>{history.map((x) => <div className="history-row" key={x.sessionId}><div><b>{x.plan.title}</b><small>{fmtDate(x.startedAt)} · {x.finishedAt ? 'завершена' : 'не завершена'}</small></div><button onClick={() => exportSession(x)}>Excel</button></div>)}</section>}
      <footer>FitProgress v0.4 · данные тренировки не отправляются на сервер<br /><span className="asset-credit">{EXERCISE_IMAGE_CREDIT}</span></footer>
    </main>
  )
}

export default function App() {
  const [session, setSessionState] = useState<WorkoutSession | null>(() => loadActiveSession())
  const [pendingPlan, setPendingPlan] = useState<WorkoutPlan | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [inWorkout, setInWorkout] = useState(() => {
    const active = loadActiveSession()
    return Boolean(active && !active.finishedAt)
  })

  const setSession = (next: WorkoutSession) => {
    setSessionState(next)
    saveActiveSession(next)
  }

  useEffect(() => {
    if (session) saveActiveSession(session)
  }, [session])

  const loadPlan = (plan: WorkoutPlan) => {
    setPendingPlan(clone(plan))
    setInWorkout(false)
    window.scrollTo(0, 0)
  }

  const beginPendingPlan = () => {
    if (!pendingPlan) return
    if (session && !session.finishedAt && !window.confirm('Текущая незавершённая тренировка будет заменена новой. Продолжить?')) return
    const next = createSession(pendingPlan)
    setSession(next)
    setPendingPlan(null)
    setInWorkout(true)
    window.scrollTo(0, 0)
  }

  const discard = () => {
    if (!window.confirm('Удалить незавершённую тренировку с этого устройства?')) return
    saveActiveSession(null)
    setSessionState(null)
  }

  const exit = () => {
    setInWorkout(false)
    window.scrollTo(0, 0)
  }

  if (session && inWorkout) return <WorkoutView session={session} setSession={setSession} onExit={exit} />
  if (pendingPlan) return <PlanPreview plan={pendingPlan} onBegin={beginPendingPlan} onBack={() => setPendingPlan(null)} />
  if (analyticsOpen) return <AnalyticsView onBack={() => setAnalyticsOpen(false)} />
  if (libraryOpen) return <ExerciseLibraryView onBack={() => setLibraryOpen(false)} />
  return <Home active={session && !session.finishedAt ? session : null} onLoadPlan={loadPlan} onResume={() => setInWorkout(true)} onDiscard={discard} onOpenLibrary={() => setLibraryOpen(true)} onOpenAnalytics={() => setAnalyticsOpen(true)} />
}
