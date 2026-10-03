# FitProgress

Мобильный офлайн-дневник силовых тренировок под сценарий **Excel → тренировка → Excel**.

## Уже есть в MVP

- импорт программы из `.xlsx` (`Workout`, `Exercises`, `Sets`);
- одностраничный мобильный интерфейс;
- редактирование веса и повторений по каждому подходу;
- быстрый RIR и шкала боли для rehab-упражнений;
- комментарий к каждому подходу;
- завершение подхода + таймер отдыха;
- замена упражнения на аналог с сохранением исходного плана и причины замены;
- автосохранение текущей тренировки в браузере;
- IndexedDB как основное долговременное локальное хранилище с автоматической миграцией старых данных;
- summary;
- экспорт результата обратно в `.xlsx`;
- PWA/offline через service worker;
- встроенный демо-план FULL BODY K;
- скачиваемый Excel-шаблон.

## Формат Excel

### Workout
`workout_id | title | priority | notes`

### Exercises
`exercise_id | order | category | name | muscle_group | movement_pattern | equipment | rehab | badge | instruction | image`

### Sets
`exercise_id | set_no | set_type | target_weight | target_reps | target_rir | rest_sec | notes`

## Локальный запуск

```bash
npm install
npm run dev
```

## GitHub Pages

Workflow `.github/workflows/deploy.yml` собирает Vite-приложение и публикует `dist` в GitHub Pages. Один раз в настройках репозитория нужно выбрать **Settings → Pages → Source: GitHub Actions**, если Pages ещё не включён.

## Приватность

Текущая тренировка и полная история сохраняются локально в IndexedDB конкретного браузера. `localStorage` используется как ограниченное совместимое зеркало и аварийный fallback. Серверная база, аккаунт, платный сервис и VPN не используются.
