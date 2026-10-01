export const SHOULDER_PROFILE = {
  updatedAt: '29.09.2026',
  phase: 'Почти полное функциональное восстановление',
  focus: 'Точечная доработка внутренней ротации и горизонтальной аддукции',
  summary: 'ER в высокой позиции и тяжёлый bottom-start жим практически восстановлены. Остаточный воспроизводимый дефицит — Cable IR из наружноротационного старта.',
  checkpoints: [
    { id: 'er', name: 'ER @75–90°', value: '6,8 кг ×10', pain: '0–0,5/10', status: 'green', note: 'Только поддержание; отдельная прогрессия больше не нужна.' },
    { id: 'incline', name: 'Incline DB bottom-start', value: '24 кг ×10×2', pain: '0,5–1/10', status: 'green', note: 'Тяжёлый bottom-start функционально освоен; ROM и вес всё ещё прогрессировать раздельно.' },
    { id: 'ir', name: 'Cable Internal Rotation', value: '9 кг ×10×2', pain: '1,5–2/10', status: 'yellow', note: 'Симптом в наружноротационном старте и первых градусах движения; затем затухает. Вес не повышать.' },
    { id: 'shoulder_press', name: 'Machine Shoulder Press', value: '36 кг ×8', pain: '≤2/10', status: 'green', note: 'Переносимость определяется стартовой глубиной больше, чем абсолютным весом.' },
    { id: 'fly', name: 'Short-Lever Cable Fly', value: '13,5 кг ×10 проба', pain: '1–2/10', status: 'green', note: 'Horizontal adduction успешно возвращается через короткий рычаг; длиннорычажный Pec Fly пока не возвращать.' }
  ],
  nextGoal: 'ER поддерживать; Shoulder/Incline Press вести как обычную силовую работу с постепенным возвратом глубины; основной rehab — IR 9 кг с прогрессией стартовой ER + постепенное увеличение рычага/ROM в horizontal adduction.',
  guardrail: 'Не прогрессировать одновременно вес, глубину/ROM и близость к отказу в нескольких жимовых/аддукционных направлениях.'
} as const
