import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { DEMO_PLAN } from './demo'
import { EXERCISE_LIBRARY, getDefinition, replacementCandidates } from './exerciseLibrary'
import { downloadTemplate, exportSession, importWorkout } from './excel'
import { archiveSession, loadActiveSession, loadHistory, saveActiveSession } from './storage'
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

function ExerciseVisual({ exercise }: { exercise: WorkoutExercise }) {
  const def = getDefinition(exercise.exerciseId)
  if (exercise.image) {
    return <img className="exercise-image" src={exercise.image} alt="" />
  }
  return (
    <div className="exercise-visual" aria-hidden="true">
      <div className="visual-dumbbell"><i /><b /><i /></div>
      <strong>{def?.icon ?? exercise.name.slice(0, 3).toUpperCase()}</strong>
      <span>{exercise.muscleGroup || exercise.movementPattern}</span>
    </div>
  )
}

function SetRow({ set, rehab, onChange, onComplete }: { set: WorkoutSet; rehab: boolean; onChange: (patch: Partial<WorkoutSet>) => void; onComplete: () => void }) {
  const setLabel = set.setType === 'working' ? `Рабочий ${set.setNo}` : set.setType === 'warmup' ? 'Разминка' : set.setType === 'calibration' ? 'Калибровка' : set.setType === 'rehab' ? `Rehab ${set.setNo}` : `Подход ${set.setNo}`
  return (
    <div className={`set-card ${set.completed ? 'is-complete' : ''}`}>
      <div className="set-topline">
        <span className="set-label">{setLabel}</span>
        <span className="target-line">План: {set.targetWeight || '—'} × {set.targetReps || '—'}{set.targetRir ? ` · RIR ${set.targetRir}` : ''}</span>
      </div>
      <div className="set-input-grid">
        <label><span>Вес</span><input inputMode="decimal" value={set.actualWeight} onChange={(e) => onChange({ actualWeight: e.target.value })} placeholder="—" /></label>
        <span className="times">×</span>
        <label><span>Повторы</span><input inputMode="decimal" value={set.actualReps} onChange={(e) => onChange({ actualReps: e.target.value })} placeholder="—" /></label>
      </div>
      <div className="quick-section">
        <span className="quick-title">RIR</span>
        <div className="chips compact">
          {['0', '1', '2', '3', '4', '5+'].map((value) => <button key={value} type="button" className={set.actualRir === value ? 'chip active' : 'chip'} onClick={() => onChange({ actualRir: set.actualRir === value ? '' : value })}>{value}</button>)}
        </div>
      </div>
      {rehab && <div className="quick-section"><span className="quick-title">Боль</span><div className="chips compact">{['0', '0,5', '1', '2', '3', '4+'].map((value) => <button key={value} type="button" className={set.pain === value ? 'chip active danger' : 'chip'} onClick={() => onChange({ pain: set.pain === value ? '' : value })}>{value}</button>)}</div></div>}
      <textarea className="comment" rows={2} value={set.comment} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Комментарий: техника, ощущения, запас…" />
      <button type="button" className={set.completed ? 'complete-button completed' : 'complete-button'} onClick={onComplete}>{set.completed ? '✓ Подход выполнен' : 'Отметить подход ✓'}</button>
    </div>
  )
}

function ReplacementSheet({ exercise, onClose, onReplace, onCustom }: { exercise: WorkoutExercise; onClose: () => void; onReplace: (def: ExerciseDefinition, reason: WorkoutExercise['replacementReason']) => void; onCustom: (reason: WorkoutExercise['replacementReason']) => void }) {
  const [reason, setReason] = useState<WorkoutExercise['replacementReason']>('Занято')
  const [query, setQuery] = useState('')
  const top = replacementCandidates(exercise)
  const all = EXERCISE_LIBRARY.filter((x) => x.id !== exercise.exerciseId && x.name.toLowerCase().includes(query.toLowerCase()))
  const options = query ? all : top.slice(0, 9)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header"><div><span className="eyebrow">ЗАМЕНА УПРАЖНЕНИЯ</span><h2>{exercise.name}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
        <p className="muted">Исходное упражнение останется в выгрузке. Выбираем только фактическую замену.</p>
        <div className="reason-row">{(['Занято', 'Дискомфорт', 'Другое'] as const).map((x) => <button key={x} className={reason === x ? 'reason active' : 'reason'} onClick={() => setReason(x)}>{x}</button>)}</div>
        <input className="search" placeholder="Найти по всей библиотеке…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="replacement-list">
          {options.map((def) => <button type="button" className="replacement-item" key={def.id} onClick={() => onReplace(def, reason)}><span className="replacement-icon">{def.icon ?? '↔'}</span><span><b>{def.name}</b><small>{def.muscleGroup} · {def.movementPattern} · {def.equipment}</small></span><span className="chevron">›</span></button>)}
          {!options.length && <div className="empty-mini">Ничего не найдено.</div>}
        </div>
        <button type="button" className="ghost big" onClick={() => onCustom(reason)}>+ Другое упражнение вручную</button>
      </div>
    </div>
  )
}

function WorkoutView({ session, setSession, onExit }: { session: WorkoutSession; setSession: (s: WorkoutSession) => void; onExit: () => void }) {
  const [replacementFor, setReplacementFor] = useState<number | null>(null)
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
        badge: exercise.badge
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
        replacementReason: reason,
        replacedAt: new Date().toISOString(),
        sets: exercise.sets.map((s, i) => ({ ...s, id: `${def.id}-${i + 1}-${Date.now()}`, actualWeight: '', actualReps: '', actualRir: '', pain: '', comment: '', completed: false, completedAt: undefined }))
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

      {session.plan.exercises.map((exercise, exerciseIndex) => (
        <section className="exercise-block" key={exercise.instanceId}>
          <div className="exercise-header">
            <ExerciseVisual exercise={exercise} />
            <div className="exercise-title-wrap">
              <span className="eyebrow">{String(exercise.order).padStart(2, '0')} · {exercise.category}</span>
              <h2>{exercise.name}</h2>
              {exercise.badge && <span className="mini-pill">{exercise.badge}</span>}
              <div className="meta-line">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</div>
            </div>
          </div>
          {exercise.exerciseId !== exercise.originalExerciseId && <div className="replacement-banner"><span>↔ План: <b>{exercise.originalName}</b><br />Факт: <b>{exercise.name}</b>{exercise.replacementReason ? ` · ${exercise.replacementReason}` : ''}</span><button onClick={() => undoReplacement(exerciseIndex)}>Вернуть исходное</button></div>}
          {exercise.instruction && <p className="instruction">{exercise.instruction}</p>}
          <div className="exercise-actions"><button className="secondary" onClick={() => setReplacementFor(exerciseIndex)}>↔ Заменить</button></div>
          <div className="sets-stack">
            {exercise.sets.map((set, setIndex) => <SetRow key={set.id} set={set} rehab={exercise.rehab} onChange={(patch) => updateSet(exerciseIndex, setIndex, patch)} onComplete={() => toggleSet(exerciseIndex, setIndex)} />)}
          </div>
        </section>
      ))}

      <section className="finish-card"><h2>Итог тренировки</h2><div className="summary-grid"><div><b>{session.plan.exercises.length}</b><span>упражнений</span></div><div><b>{totals.doneSets}/{totals.totalSets}</b><span>подходов</span></div><div><b>{totals.replacements}</b><span>замен</span></div><div><b>{totals.volume ? Math.round(totals.volume).toLocaleString('ru-RU') : '—'}</b><span>объём*</span></div></div><small>* Тоннаж считается только там, где вес и повторы начинаются с числа.</small><button className="primary big" onClick={finish}>Завершить тренировку</button><button className="secondary big" onClick={() => exportSession(session)}>Выгрузить Excel сейчас</button></section>

      {restLeft > 0 && <div className="rest-timer"><span>Отдых</span><b>{fmtDuration(restLeft)}</b><button onClick={() => setRestLeft((x) => x + 30)}>+30с</button><button onClick={() => setRestLeft(0)}>Пропустить</button></div>}
      {replacementFor !== null && <ReplacementSheet exercise={session.plan.exercises[replacementFor]} onClose={() => setReplacementFor(null)} onReplace={(def, reason) => replaceExercise(replacementFor, def, reason)} onCustom={(reason) => replaceCustom(replacementFor, reason)} />}
    </main>
  )
}

function Home({ active, onStart, onResume, onDiscard }: { active: WorkoutSession | null; onStart: (plan: WorkoutPlan) => void; onResume: () => void; onDiscard: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const history = loadHistory().slice(0, 3)

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setError('')
      const plan = await importWorkout(file)
      onStart(plan)
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
        <button className="secondary huge" onClick={() => onStart(DEMO_PLAN)}><span>▶</span><div><b>Открыть FULL BODY K</b><small>тестовый план по твоим скринам</small></div></button>
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
  const [inWorkout, setInWorkout] = useState(Boolean(loadActiveSession()))

  const setSession = (next: WorkoutSession) => {
    setSessionState(next)
    saveActiveSession(next)
  }

  useEffect(() => {
    if (session) saveActiveSession(session)
  }, [session])

  const start = (plan: WorkoutPlan) => {
    if (session && !session.finishedAt && !window.confirm('Текущая тренировка будет заменена новой. Продолжить?')) return
    const next = createSession(plan)
    setSession(next)
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
  return <Home active={session && !session.finishedAt ? session : null} onStart={start} onResume={() => setInWorkout(true)} onDiscard={discard} />
}
