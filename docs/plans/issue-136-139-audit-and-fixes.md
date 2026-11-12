# План работ: Аудит и устранение замечаний #136, #137, #138, #139

**Проект:** `@goodandready/dsh-agent-loop-guard`  
**Ветка:** `fix/audit-and-fixes-136-139`  
**Каталог:** `.worktrees/fix-audit-136-139`  
**Целевая версия:** `0.2.29`

---

## 1. Контекст и цели

В рамках аудита плагина и подготовки релиза `0.2.29` необходимо закрыть 4 зарегистрированных issue и устранить замечания preflight:

1. **#136 (Docs / Scope):** Отсутствуют входные документы `AGENTS.md`, `index.md`, `deploy.sh`. Необходимо создать их по стандарту DSH и гарантировать их исключение из публикации (npm и публичный GitHub-зеркало).
2. **#137 (Tech-debt / Release):** В корне репозитория были обнаружены релизные архивы `.tgz`. Необходимо переместить их в `/home/vadim/.dsh/artifacts/`, добавить проверку `scripts/pack-check.mjs` (fail при наличии `*.tgz` в корне, контроль размера файлов $\le 256$ KiB), добавить команду `npm run pack:check` и связать её с `npm run check`.
3. **#138 (Security / Audit):** `npm audit --omit=dev` находит уязвимости `zod` (GHSA-mrhx-c7xc-m3w5, high) и `fast-uri` (GHSA-w74x-v6f9-j3xg, moderate). Необходимо зафиксировать `overrides` в `package.json` (`zod >= 4.6.6`, `fast-uri >= 3.1.9`), обновить `package-lock.json`, убедиться в отсутствии уязвимостей и сохранении полной работоспособности тестов.
4. **#139 (Tech-debt / Code):** Экспорт `DEFAULT_STOP_PATTERNS` в `lib/guard-state.js` не имеет потребителей и вызывал предупреждение `preflight.sh`. Необходимо удалить неиспользуемый экспорт, зафиксировать архитектурное решение в `docs/design/DESIGN.md`.
5. **Аудит Preflight (Лимиты строк):** `lib/guard-state.js` насчитывал 775 строк (при лимите 600 строк). Вынести вспомогательные утилиты анализа осцилляций, фингерпринтов и шаблонов в `lib/guard-helpers.js` с прозрачным реэкспортом из `lib/guard-state.js`.

---

## 2. Пошаговый план реализации

### Этап 1: Устранение дефекта #139 и декомпозиция `lib/guard-state.js`
- Создать `lib/guard-helpers.js`, перенести вспомогательные функции (`detectOscillation`, `isDefaultStopRequest`, `compilePseudoToolPatterns`, `isPseudoToolCallText`, `compileStopPatterns`, `callFingerprint`, `callRepeatFingerprint`, `resultFingerprint`, `safeCallSummary`, `outcomeFromExecution`, `positiveInteger`, `nonNegativeInteger`).
- Удалить мертвый экспорт `DEFAULT_STOP_PATTERNS`.
- В `lib/guard-state.js` импортировать и реэкспортировать эти хелперы для полной обратной совместимости.
- Проверить, что `lib/guard-state.js` < 600 строк и `lib/guard-helpers.js` < 600 строк.

### Этап 2: Устранение уязвимостей #138 (`zod`, `fast-uri`)
- Добавить `overrides` в `package.json`.
- Запустить `npm install` (через локальный SOCKS5 proxy).
- Проверить `npm audit --omit=dev` -> 0 уязвимостей.

### Этап 3: Создание проверки пакетов #137 (`scripts/pack-check.mjs`)
- Создать `scripts/pack-check.mjs`:
  - Проверка отсутствия `*.tgz` в корне проекта.
  - Проверка `npm pack --dry-run --json` на лимит размера 262144 байт на файл.
- Добавить скрипт `"pack:check": "node scripts/pack-check.mjs"` в `package.json`.
- Обновить `"check"` в `package.json`, чтобы он включал `npm run pack:check` и `node --check lib/guard-helpers.js`.

### Этап 4: Создание входных документов #136 (`AGENTS.md`, `index.md`, `deploy.sh`, `.gitattributes`)
- Создать `AGENTS.md` со специфичными правилами проекта.
- Создать `index.md` с картой модулей, архитектурой, командами и тестовой матрицей.
- Создать исполняемый `deploy.sh` со стандартным пайплайном проверок и установки в профиль `web`.
- Добавить `.gitattributes` с `export-ignore` для служебных файлов.
- Убедиться, что `package.json` `files` и `scripts/publish-github.sh` не включают их в дистрибутив.

### Этап 5: Верификация тестов и preflight
- Выполнить `npm test` (все 114 тестов зеленые).
- Выполнить `npm run check`.
- Выполнить `bash ~/.dsh/skills/dsh-plugin-preflight/scripts/preflight.sh .` (FAIL=0, без предупреждений о лимитах строк и мертвых экспортах).

### Этап 6: Документация и релиз
- Обновить `docs/design/DESIGN.md`, `CHANGELOG.md`, `README.md`, `README.ru.md`, `README.zh.md`.
- Поднять версию до `0.2.29`.
- Сформировать коммит через `/home/vadim/.ssh/bin/git-antigravity`.
- Создать PR на Gitea, выполнить слияние, публикацию в npm, зеркалирование на GitHub, деплой на production MiniAI (`dsh-web.service`) и закрытие issue.

