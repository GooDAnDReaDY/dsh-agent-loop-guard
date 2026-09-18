# DESIGN.md — @goodandready/dsh-agent-loop-guard

## Product / Purpose
- **Назначение:** Отказоустойчивый runtime-предохранитель среды выполнения DeepSeek Harness для предотвращения бесконечных циклов вызовов инструментов (tool calls) и зацикливания потокового вывода ассистента (streaming assistant output).
- **Аудитория:** Разработчики, администраторы и пользователи автономных агентных систем на базе DeepSeek Harness, сталкивающиеся с расходом контекста, токенов и зависанием сессий.
- **Статус:** Production-плагин, v0.2.5 (активная разработка расширений: One-Click Updater, EN/ZH i18n, телеметрия, адаптивные квоты, dry-run).

## User Surfaces
- **Web/UI:** Карточка настроек плагина во вкладке «Настройки → Плагины → Настройки плагинов» (`settings.plugin.item`). Свой раздел в боковом списке отсутствует (согласно `dsh-plugin-authoring`).
- **DSH UI / settings / slots:**
  - Слот: `settings.plugin.item`, `order: 95`, `locale: @goodandready/dsh-agent-loop-guard`.
  - Элементы карточки:
    - Заголовок с иконкой и версионным бейджем.
    - Секция One-Click обновления (индикатор проверки, кнопка «Update Now» при наличии новой версии в npm).
    - Секция телеметрии живой защиты (счётчики заблокированных петель сессии).
    - Форма параметров: числовые поля (`maxToolAttemptsPerTurn`, `maxProgressToolCallsPerTurn`, `maxCallsPerRepeatGroup`, `maxRepeatedAssistantLines`, `maxRepeatedAssistantBlocks`, `maxAssistantBlockChars`; устаревший алиас `maxCallsPerToolPerTurn` сохранён в схеме для обратной совместимости, но опущен в UI), чекбоксы (`blockExactDuplicates`, `assistantOutputGuard`, `dryRunMode`), текстовые списки (`progressToolNames`, `strictTools`).
    - Кнопка сохранения с индикацией статуса (`Saving...`, `Saved`, ошибки валидации).
- **API:**
  - Route: `/api/@goodandready/dsh-agent-loop-guard/update` (GET — статус версий, POST — доверенное обновление с обязательной проверкой x-dsh-plugin-update, loopback и same-origin).
  - Route: `/api/@goodandready/dsh-agent-loop-guard/telemetry` (GET — данные телеметрии петлезащиты для loopback/same-origin; POST — доверенный сброс счётчиков с проверкой loopback remoteAddress, sec-fetch-site и совпадения origin/host, 403 при cross-origin или не-loopback).
- **CLI:**
  - Установка и обновление через штатный DSH CLI: `dsh plugin --profile web add @goodandready/dsh-agent-loop-guard`.
- **Документация:**
  - `README.md` (English, canonical)
  - `README.ru.md` (Русский, синхронизированная проектная документация)
  - `README.zh.md` (中文, обязательная пользовательская документация)

## Visual Direction
- **Атмосфера:** Утилитарный, надёжный, сдержанный инженерный интерфейс системной безопасности. Интеграция «как родной» в дизайн-систему DeepSeek Harness.
- **Утверждённые референсы:** Нативные компоненты DSH Web UI (`settingsScope`, css-переменные темы `--dsw-alias-*`, примитивы `@deepseek-ai/dsh-client-ui-primitives`).
- **Не копировать:** Кастомные несогласованные темы, яркие несистемные градиенты, сторонние тяжелые библиотеки компонентов (MUI, AntD), эмодзи-заголовки.
- **Стилизация и анимации:**
  - CSS внедряется через `<style id="dsh-agent-loop-guard-styles" data-dsh-plugin="...">` с изолированными классами `.alg-*`.
  - Заголовки разделов и шапка оформлены в строгом нативном стиле без визуального шума и эмодзи (`title`, `telemetryTitle`).
  - Стрелка раскрытия карточки использует системный примитив `IconChevronDownOutline14` (с fallback на нативный SVG-шеврон) с плавным поворотом `transform: rotate(180deg)` при разворачивании.

## Foundations
- **Цвета и роли:**
  - Фон карточки: `var(--dsw-alias-bg-layer-3)`
  - Границы: `var(--dsw-alias-border-l2)`, hover: `var(--dsw-alias-border-l1)`
  - Основной текст: `var(--dsw-alias-label-primary)`
  - Вторичный текст / подписи полей: `var(--dsw-alias-label-secondary)`
  - Третичный текст / шевроны: `var(--dsw-alias-label-tertiary)`
  - Акцент обновления / кнопки сохранения: `var(--dsw-alias-accent-primary, #3b82f6)`
  - Предупреждения / ошибки: `var(--dsw-alias-status-danger, #ef4444)`
  - Успешное сохранение / актуальность: `var(--dsw-alias-status-success, #10b981)`
- **Типографика:**
  - Системный шрифт DSH (`Plus Jakarta Sans` / системный UI стек, моноширинный для кодов и версий).
  - Размеры: Заголовок 15px (font-weight: 600), подзаголовок 13px, метки полей 13px, числовые поля 13px.
- **Сетка, отступы, responsive:**
  - Скругление карточки: `12px`.
  - Внутренние отступы шапки: `14px 16px`.
  - Отступы полей ввода: `padding: 10px 0`, расстояние между меткой и полем `6px`.
  - Адаптивность: 100% ширина контейнера, резиновые поля.
- **Accessibility:**
  - Семантические теги `<label>`, ассоциированные с input через `htmlFor` и уникальные `id` (`alg-<key>`).
  - Атрибут `aria-expanded` для сворачиваемой карточки.
  - Достаточный контраст текста по шкале WCAG AA через системные CSS-переменные.

## Components And States
- **Компоненты:**
  1. `PluginCard`: Сворачиваемый контейнер карточки настроек с шевроном поворота на 180°.
  2. `UpdateSection`: Блок проверки и запуска one-click обновления с npm.
  3. `TelemetryBadge`: Индикатор защитных срабатываний в текущем процессе DSH.
  4. `SettingsForm`: Набор типизированных полей ввода.
  5. `SaveButton`: Кнопка фиксации настроек через `scope.set()`.
- **Loading / empty / error / success:**
  - `status === 'loading'`: отображение скелетона/загрузки данных из `settingsScope`.
  - `status === 'unavailable'`: отображение предупреждения о недоступности пространства настроек (блокировка полей ввода от ложного редактирования).
  - `status === 'ready'`: интерактивная форма со значениями по умолчанию или сохранёнными настройками.
  - Сохранение: отображение `Saving...` (`正在保存…`), при успехе `Saved` (`已保存`), при ошибках перечисление ключей.
  - Обновление: `Checking updates...`, `Up to date` (`已是最新版本`), `Update available: vX.Y.Z` (`发现新版本`), `Updating...` (`正在更新…`), `Restart required` (`需要重启服务`).

## User Flows
- **Критический сценарий 1 (Пресечение зацикливания инструмента):**
  1. Агент вызывает инструмент (например, `read_file`) с теми же аргументами без изменения результата или превышает квоту группы.
  2. Guard блокирует вызов с кодом `LOOP_GUARD_DUPLICATE` / `LOOP_GUARD_REPEAT`.
  3. Модель получает структурированную инструкцию `[LOOP_GUARD_DUPLICATE] ... STOP repeating this action ...`.
  4. Модель переключается на альтернативный инструмент или переходит к синтезу ответа.
  5. В телеметрии карточки инкрементируется счётчик нарушений.
- **Критический сценарий 2 (One-Click обновление плагина):**
  1. Администратор открывает Настройки → Плагины → Agent Loop Guard.
  2. Карточка запрашивает `/api/@goodandready/dsh-agent-loop-guard/update`.
  3. При наличии новой версии отображается кнопка «Update Now».
  4. Пользователь нажимает кнопку. Отправляется POST-запрос с `x-dsh-plugin-update: 1`.
  5. DSH CLI устанавливает точную версию. Кнопка блокируется от повторных кликов.
  6. Интерфейс сообщает: `Updated successfully. Restart DSH service to apply changes.`.

## Architecture & Reusable Components
- **Plugin Updater (`lib/plugin-updater.js`):**
  - Реализация основана на каноническом шаблоне `references/plugin-updater.ts` с поддержкой безопасной проверки версий semver, loopback/same-origin валидации и флага `x-dsh-plugin-update`.
  - Маршрут эндпоинта зафиксирован как `/api/@goodandready/dsh-agent-loop-guard/update` (совпадает с полным именем npm-пакета плагина для изоляции пространства имён роутера DSH Web).
  - Флаг `--config.minimumReleaseAge=0` задействован в CLI-командах установки для предотвращения задержек распространения новых npm-релизов в локальной среде pnpm.

## Internationalization & Localization (Do / Don't)
- **Do:**
  - Код плагина, схемы настроек, логи и системные сообщения — **English (`en`)**.
  - Пользовательский интерфейс плагина обязан поддерживать **English (`en`)** и **Chinese (`zh`)**.
  - Все новые ключи для русского перевода регистрируются через issue в Gitea `goodandready/dsh-russian-lang` со сравнительной таблицей `Key | English | Chinese | Proposed Russian`.
  - Документация в репозитории ведётся на 3 языках (`README.md`, `README.ru.md`, `README.zh.md`).
- **Don't:**
  - **Запрещено** хардкодить русские строки, русские дефолты или русский словарь `ru` внутри кода плагина (`lib/client.js`, `lib/index.js`).
  - **Запрещено** удалять существующие описания фич в документации при релизе (только additive-обновление).
  - **Запрещено** менять вторую цифру версии $y$ без явной прямой команды пользователя.
