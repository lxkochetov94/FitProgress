import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { DEMO_PLAN } from './demo'
import { EXERCISE_LIBRARY, getDefinition, replacementCandidates } from './exerciseLibrary'
import { downloadTemplate, exportSession, importWorkout } from './excel'
import { archiveSession, loadActiveSession, loadHistory, saveActiveSession } from './storage'
import { BUILTIN_EXERCISE_IMAGES } from './exerciseImages'
import { SHOULDER_PROFILE } from './shoulderProfile'
import type { ExerciseDefinition, WorkoutExercise, WorkoutPlan, WorkoutSession, WorkoutSet } from './types'

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

const perSideLabel = (exercise: WorkoutExercise) =>
  exercise.perSide === 'arm' ? 'на каждую руку' :
  exercise.perSide === 'leg' ? 'на каждую ногу' :
  exercise.perSide === 'side' ? 'на каждую сторону' : ''

const exerciseDisplayName = (exercise: WorkoutExercise) => {
  const suffix = perSideLabel(exercise)
  return suffix ? `${exercise.name} · ${suffix}` : exercise.name
}

const isWarmupExercise = (exercise: WorkoutExercise) =>
  /размин/i.test(exercise.category) ||
  (exercise.sets.length > 0 && exercise.sets.every((set) => set.setType === 'warmup'))

const isLegacyNewBadge = (badge?: string) => Boolean(badge && /нов(ая|ое|ый)|new/i.test(badge))

function ExerciseVisual({ exercise, compact = false }: { exercise: WorkoutExercise; compact?: boolean }) {
  const def = getDefinition(exercise.exerciseId)
  const image = exercise.image || BUILTIN_EXERCISE_IMAGES[exercise.exerciseId]
  if (image) {
    return <img className={compact ? 'exercise-thumb' : 'exercise-image'} src={image} alt={exerciseDisplayName(exercise)} />
  }
  return (
    <div className={compact ? 'exercise-thumb exercise-thumb-placeholder' : 'exercise-visual'} aria-label="Изображение упражнения пока не добавлено">
      {!compact && <div className="visual-dumbbell"><i /><b /><i /></div>}
      <strong>{def?.icon ?? exercise.name.slice(0, 3).toUpperCase()}</strong>
      {!compact && <span>{exercise.muscleGroup || exercise.movementPattern}</span>}
    </div>
  )
}

function SetRow({ set, rehab, weightUnit = 'kg', onChange, onComplete }: { set: WorkoutSet; rehab: boolean; weightUnit?: 'kg' | 'lb'; onChange: (patch: Partial<WorkoutSet>) => void; onComplete: () => void }) {
  const setLabel = set.setType === 'working' ? `Рабочий ${set.setNo}` : set.setType === 'warmup' ? 'Разминка' : set.setType === 'calibration' ? 'Калибровка' : `Подход ${set.setNo}`
  const unit = weightUnit === 'lb' ? 'lbs' : 'кг'
  return (
    <div className={`plan-fact-set ${set.completed ? 'is-complete' : ''}`}>
      <div className="pf-set-title"><b>{setLabel}</b>{set.completed && <span>✓ выполнен</span>}</div>
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
        <span>{rehab ? '≤2' : '—'}</span>
      </div>
      <div className="pf-grid pf-fact">
        <b>Факт</b>
        <input aria-label={`Фактический вес, ${unit}`} inputMode="decimal" value={set.actualWeight} onChange={(e) => onChange({ actualWeight: e.target.value })} placeholder="—" />
        <input aria-label="Фактические повторы" inputMode="decimal" value={cleanReps(set.actualReps)} onChange={(e) => onChange({ actualReps: e.target.value })} placeholder="—" />
        <input aria-label="Фактический RIR" inputMode="decimal" value={set.actualRir} onChange={(e) => onChange({ actualRir: e.target.value })} placeholder="—" />
        {rehab ? <input aria-label="Боль от 0 до 10" inputMode="decimal" value={set.pain} onChange={(e) => onChange({ pain: e.target.value })} placeholder="0" /> : <span className="pf-na">—</span>}
      </div>
      <div className="pf-bottom">
        <textarea className="comment compact-comment" rows={1} value={set.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Комментарий к подходу…" />
        <button type="button" className={set.completed ? 'set-check completed' : 'set-check'} onClick={onComplete} aria-label={set.completed ? 'Подход выполнен' : 'Отметить подход выполненным'}>{set.completed ? '✓' : '○'}</button>
      </div>
    </div>
  )
}

function ReplacementSheet({ exercise, onClose, onReplace, onCustom }: { exercise: WorkoutExercise; onClose: () => void; onReplace: (def: ExerciseDefinition, reason: WorkoutExercise['replacementReason']) => void; onCustom: (reason: WorkoutExercise['replacementReason']) => void }) {
  const [reason, setReason] = useState<WorkoutExercise['replacementReason']>('Занято')
  const [query, setQuery] = useState('')
  const top = replacementCandidates(exercise)
  const needle = query.trim().toLowerCase()
  const all = EXERCISE_LIBRARY.filter((x) => x.id !== exercise.exerciseId && (
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
          {options.map((def) => <button type="button" className={`replacement-item ${def.suitability === 'avoid' ? 'avoid' : def.suitability === 'caution' ? 'caution' : ''}`} key={def.id} onClick={() => onReplace(def, reason)}><span className="replacement-icon">{def.icon ?? '↔'}</span><span><b>{def.name}</b><small>{def.muscleGroup} · {def.movementPattern} · {def.equipment}{def.gym ? ` · ${def.gym}` : ''}</small>{def.lastKnown && <small className="history-mini">Последняя база: {def.lastKnown}</small>}{def.suitability === 'avoid' && <small className="avoid-mini">История: не использовать как обычную замену</small>}{def.suitability === 'caution' && <small className="caution-mini">Есть ограничение / rehab-контекст</small>}</span><span className="chevron">›</span></button>)}
          {!options.length && <div className="empty-mini">Ничего не найдено.</div>}
        </div>
        <button type="button" className="ghost big" onClick={() => onCustom(reason)}>+ Другое упражнение вручную</button>
      </div>
    </div>
  )
}

function WorkoutView({ session, setSession, onExit }: { session: WorkoutSession; setSession: (s: WorkoutSession) => void; onExit: () => void }) {
  const [replacementFor, setReplacementFor] = useState<number | null>(null)
  const [openExercise, setOpenExercise] = useState<string | null>(() => session.plan.exercises.find((exercise) => exercise.startedAt && !exercise.finishedAt)?.instanceId ?? null)
  const history = useMemo(() => loadHistory(), [session.sessionId])
  const [restLeft, setRestLeft] = useState(0)
  const [finishedSummary, setFinishedSummary] = useState(Boolean(session.finishedAt))

  useEffect(() => {
    if (restLeft <= 0) return
    const t = window.setInterval(() => setRestLeft((x) => Math.max(0, x - 1)), 1000)
    return () => window.clearInterval(t)
  }, [restLeft])

  const totals = useMemo(() => {
    const sets = session.plan.exercises.flatMap((e) => e.sets)
    const done = sets.filter((s) => s.completed)
    const volume = session.plan.exercises.flatMap((e) => e.sets).reduce((acc, s) => {
      if (!s.completed) return acc
      const w = parseNumeric(s.actualWeight)
      const r = parseNumeric(s.actualReps)
      return acc + (Number.isFinite(w) && Number.isFinite(r) ? w * r : 0)
    }, 0)
    return { totalSets: sets.length, doneSets: done.length, volume, replacements: session.plan.exercises.filter((e) => e.exerciseId !== e.originalExerciseId).length }
  }, [session])

  const mutateExercise = (index: number, fn: (exercise: WorkoutExercise) => WorkoutExercise) => {
    const next = clone(session)
    next.plan.exercises[index] = fn(next.plan.exercises[index])
    next.updatedAt = new Date().toISOString()
    setSession(next)
  }

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<WorkoutSet>) => mutateExercise(exerciseIndex, (exercise) => {
    exercise.sets[setIndex] = { ...exercise.sets[setIndex], ...patch }
    return exercise
  })

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    const current = session.plan.exercises[exerciseIndex].sets[setIndex]
    const completed = !current.completed
    updateSet(exerciseIndex, setIndex, { completed, completedAt: completed ? new Date().toISOString() : undefined })
    if (completed) setRestLeft(current.restSec || 90)
  }

  const openExerciseAt = (index: number) => {
    const exercise = session.plan.exercises[index]
    if (!exercise.startedAt) {
      mutateExercise(index, (draft) => ({ ...draft, startedAt: new Date().toISOString() }))
    }
    setOpenExercise(exercise.instanceId)
  }

  const finishExercise = (index: number) => {
    const exercise = session.plan.exercises[index]
    const incomplete = exercise.sets.filter((set) => !set.completed).length
    if (incomplete > 0 && !window.confirm(`В упражнении ещё не отмечено ${incomplete} подходов. Всё равно завершить?`)) return
    mutateExercise(index, (draft) => ({ ...draft, finishedAt: new Date().toISOString() }))
    setOpenExercise(null)
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

  const finish = () => {
    const incomplete = totals.totalSets - totals.doneSets
    if (incomplete > 0 && !window.confirm(`Ещё не отмечено ${incomplete} подходов. Всё равно завершить тренировку?`)) return
    const next = { ...session, finishedAt: session.finishedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }
    setSession(next)
    archiveSession(next)
    setFinishedSummary(true)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }

  if (finishedSummary) {
    const end = session.finishedAt ? new Date(session.finishedAt) : new Date()
    const duration = Math.max(0, Math.round((end.getTime() - new Date(session.startedAt).getTime()) / 60000))
    return <main className="app-shell"><header className="topbar"><button className="back" onClick={onExit}>‹</button><span>FitProgress</span><span className="status-dot">сохранено</span></header><section className="summary-card"><span className="pill">Тренировка завершена</span><h1>{session.plan.title}</h1><p>{fmtDate(session.startedAt)} · {fmtTime(session.startedAt)}–{fmtTime(end.toISOString())}</p><div className="summary-grid"><div><b>{session.plan.exercises.length}</b><span>упражнений</span></div><div><b>{totals.doneSets}/{totals.totalSets}</b><span>подходов</span></div><div><b>{duration}</b><span>минут</span></div><div><b>{totals.replacements}</b><span>замен</span></div></div><button className="primary big" onClick={() => exportSession(session)}>Выгрузить Excel</button><button className="secondary big" onClick={() => setFinishedSummary(false)}>Вернуться к тренировке</button><button className="ghost big" onClick={onExit}>На главный экран</button></section></main>
  }

  return (
    <main className="app-shell workout-page">
      <header className="topbar sticky"><button className="back" onClick={onExit}>‹</button><span>FitProgress</span><span className="status-dot">автосохранение</span></header>
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
          const definition = getDefinition(exercise.exerciseId)
          const doneSets = exercise.sets.filter((set) => set.completed).length
          const representative = exercise.sets.find((set) => set.setType === 'working') ?? exercise.sets[exercise.sets.length - 1]
          const hasLocalHistory = history.some((past) => past.plan.exercises.some((pastExercise) => pastExercise.exerciseId === exercise.exerciseId || pastExercise.originalExerciseId === exercise.exerciseId))
          const isNew = !(definition?.known || hasLocalHistory)
          if (!isOpen) {
            return (
              <button type="button" className={`exercise-preview-row ${exercise.finishedAt ? 'is-finished' : ''}`} key={exercise.instanceId} onClick={() => openExerciseAt(exerciseIndex)}>
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
                  </div>
                </div>
                <span className="row-chevron">›</span>
              </button>
            )
          }

          return (
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
                  {definition?.known && <span className="context-tag known">Есть ретро</span>}
                  {definition?.suitability === 'caution' && <span className="context-tag caution">Ограничение</span>}
                  {definition?.suitability === 'avoid' && <span className="context-tag avoid">Не использовать</span>}
                  {isNew && <span className="context-tag new">Новое</span>}
                  {exercise.exerciseId !== exercise.originalExerciseId && <span className="context-tag replacement">Замена</span>}
                </div>
                {exercise.instruction && <p className="instruction">{exercise.instruction}</p>}
                {definition?.known && (definition.lastKnown || definition.bestKnown || definition.historyNote || definition.lastPain) && <div className={`history-card ${definition.suitability === 'avoid' ? 'avoid' : definition.suitability === 'caution' ? 'caution' : ''}`}>
                  <div className="history-card-head"><b>Накопленная база</b>{definition.gym && <span>{definition.gym}</span>}</div>
                  <div className="history-values">
                    {definition.lastKnown && <div><span>Последняя база</span><b>{definition.lastKnown}</b></div>}
                    {definition.bestKnown && <div><span>Лучший результат</span><b>{definition.bestKnown}</b></div>}
                    {definition.lastPain && <div><span>Плечо / боль</span><b>{definition.lastPain}</b></div>}
                  </div>
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
                {exercise.sets.map((set, setIndex) => <SetRow key={set.id} set={set} rehab={exercise.rehab} weightUnit={exercise.weightUnit ?? 'kg'} onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)} onComplete={() => toggleSet(exerciseIndex, setIndex)} />)}
              </div>

              <button className="primary big finish-exercise" type="button" onClick={() => finishExercise(exerciseIndex)}>Завершить упражнение</button>
            </section>
          )
        })}
      </section>

      <section className="finish-card"><h2>Итог тренировки</h2><div className="summary-grid"><div><b>{session.plan.exercises.length}</b><span>упражнений</span></div><div><b>{totals.doneSets}/{totals.totalSets}</b><span>подходов</span></div><div><b>{totals.replacements}</b><span>замен</span></div><div><b>{totals.volume ? Math.round(totals.volume).toLocaleString('ru-RU') : '—'}</b><span>объём*</span></div></div><small>* Тоннаж считается только там, где вес и повторы начинаются с числа.</small><button className="primary big" onClick={finish}>Завершить тренировку</button><button className="secondary big" onClick={() => exportSession(session)}>Выгрузить Excel сейчас</button></section>

      {restLeft > 0 && <div className="rest-timer"><span>Отдых</span><b>{fmtDuration(restLeft)}</b><button onClick={() => setRestLeft((x) => x + 30)}>+30с</button><button onClick={() => setRestLeft(0)}>Пропустить</button></div>}
      {replacementFor !== null && <ReplacementSheet exercise={session.plan.exercises[replacementFor]} onClose={() => setReplacementFor(null)} onReplace={(def, reason) => replaceExercise(replacementFor, def, reason)} onCustom={(reason) => replaceCustom(replacementFor, reason)} />}
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
  const needle = query.trim().toLowerCase()
  const items = EXERCISE_LIBRARY
    .filter((exercise) => exercise.known)
    .filter((exercise) => scope === 'all' ? true : scope === 'rehab' ? Boolean(exercise.rehab) : exercise.gym !== 'Старый зал')
    .filter((exercise) => !needle || [exercise.name, exercise.muscleGroup, exercise.equipment, ...(exercise.aliases ?? [])].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (a.suitability === 'avoid' && b.suitability !== 'avoid') return 1
      if (b.suitability === 'avoid' && a.suitability !== 'avoid') return -1
      return a.muscleGroup.localeCompare(b.muscleGroup, 'ru') || a.name.localeCompare(b.name, 'ru')
    })

  const currentCount = EXERCISE_LIBRARY.filter((x) => x.known && x.gym === 'Новый зал').length
  const legacyCount = EXERCISE_LIBRARY.filter((x) => x.known && x.gym === 'Старый зал').length
  const rehabCount = EXERCISE_LIBRARY.filter((x) => x.known && x.rehab).length

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
            <div className="library-item-head">
              <div><span className="eyebrow">{exercise.muscleGroup} · {exercise.equipment}</span><h2>{exercise.name}</h2></div>
              <div className="library-badges">
                {exercise.gym && <span>{exercise.gym}</span>}
                {exercise.rehab && <span className="rehab">Rehab</span>}
                {exercise.suitability === 'caution' && <span className="caution">Ограничение</span>}
                {exercise.suitability === 'avoid' && <span className="avoid">Не использовать</span>}
              </div>
            </div>
            <div className="library-values">
              {exercise.lastKnown && <div><span>Последняя база</span><b>{exercise.lastKnown}</b></div>}
              {exercise.bestKnown && <div><span>Лучший результат</span><b>{exercise.bestKnown}</b></div>}
              {exercise.lastPain && <div><span>Боль / плечо</span><b>{exercise.lastPain}</b></div>}
            </div>
            {exercise.historyNote && <p>{exercise.historyNote}</p>}
          </article>
        ))}
        {!items.length && <div className="empty-mini">Ничего не найдено.</div>}
      </section>
    </main>
  )
}

function Home({ active, onLoadPlan, onResume, onDiscard, onOpenLibrary }: { active: WorkoutSession | null; onLoadPlan: (plan: WorkoutPlan) => void; onResume: () => void; onDiscard: () => void; onOpenLibrary: () => void }) {
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
        <button className="secondary huge" onClick={() => onLoadPlan(DEMO_PLAN)}><span>▶</span><div><b>Открыть FULL BODY K</b><small>тестовый план по твоим скринам</small></div></button>
        <button className="secondary huge" onClick={onOpenLibrary}><span>≡</span><div><b>База упражнений</b><small>ретро-данные, рабочие веса и rehab-контекст</small></div></button>
        <button className="ghost huge" onClick={downloadTemplate}><span>↓</span><div><b>Скачать Excel-шаблон</b><small>этот формат я буду готовить тебе дальше</small></div></button>
      </section>
      {error && <div className="error-box">{error}</div>}
      <section className="offline-card"><b>Без интернета</b><p>После первого полного открытия установленная PWA хранит интерфейс локально. Текущая тренировка — в памяти Safari на устройстве.</p></section>
      {history.length > 0 && <section className="history"><span className="eyebrow">ПОСЛЕДНИЕ ТРЕНИРОВКИ</span>{history.map((x) => <div className="history-row" key={x.sessionId}><div><b>{x.plan.title}</b><small>{fmtDate(x.startedAt)} · {x.finishedAt ? 'завершена' : 'не завершена'}</small></div><button onClick={() => exportSession(x)}>Excel</button></div>)}</section>}
      <footer>FitProgress v0.1 · данные тренировки не отправляются на сервер</footer>
    </main>
  )
}

export default function App() {
  const [session, setSessionState] = useState<WorkoutSession | null>(() => loadActiveSession())
  const [pendingPlan, setPendingPlan] = useState<WorkoutPlan | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
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
  if (libraryOpen) return <ExerciseLibraryView onBack={() => setLibraryOpen(false)} />
  return <Home active={session && !session.finishedAt ? session : null} onLoadPlan={loadPlan} onResume={() => setInWorkout(true)} onDiscard={discard} onOpenLibrary={() => setLibraryOpen(true)} />
}
