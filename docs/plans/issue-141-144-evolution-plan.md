# План реализации эволюционного релиза v0.3.0 (#141, #142, #143, #144)

**Проект:** `@goodandready/dsh-agent-loop-guard`  
**Ветка:** `feat/evolution-141-144`  
**Каталог:** `.worktrees/feat-evolution-141-144`  
**Версия:** `0.3.0`

---

## 1. Задачи релиза

1. **#141: Error Thrashing Guard**
   - Детекция серий повторяющихся ошибок одного типа (`ENOENT`, `EACCES`, `EXIT_CODE_*`, `HTTP_*`).
   - Сигнатурный нормализатор ошибок в `lib/guard-helpers.js`.
   - Отслеживание в `LoopGuardState`: `consecutiveFailures`, `errorRepeatCount`, сброс при успешном прогрессе.
   - Порог `maxConsecutiveFailures` (default: 4) и флаг `errorThrashingGuard: boolean` (default: true).
   - Код блокировки: `LOOP_GUARD_ERROR_THRASHING`.

2. **#142: Smart Steering (Адаптивное самоисправление)**
   - Двухступенчатая защита: вместо мгновенной жесткой блокировки при первом обнаружении развивающейся петли (повтор, осцилляция или серия ошибок) страж возвращает направляющий промпт `[LOOP_GUARD_STEER]`.
   - Директива требует от модели немедленно сменить стратегию или предоставить финальный ответ пользователю.
   - Если следующий шаг продолжает цикл — срабатывает жесткая блокировка `answerOnly` / `agent.cancel()`.
   - Флаг `adaptiveSteering: boolean` (default: true) с `.volatile()` в Schemastery.

3. **#143: Incident Journal & Post-Mortem в UI**
   - Кольцевой буфер `incidents` (емкость 20 записей) в `LoopGuardState`.
   - Запись каждого инцидента: `timestamp`, `session`, `code`, `tool`, `detail`, `chain` (история вызовов).
   - Расширение API `/api/@goodandready/dsh-agent-loop-guard/telemetry` полем `incidents`.
   - Интерактивная секция в UI Settings Card с бейджами инцидентов и кнопкой «Копировать диагностический дамп».

4. **#144: Sensitivity Presets (Пресеты чувствительности)**
   - 3 профиля настроек: `Strict` (строгий), `Balanced` (по умолчанию), `Autonomous Coding` (расширенный).
   - Однокнопочный селектор пресета в заголовке карточки настроек DSH Web UI.
   - Синхронное обновление параметров формы с подтверждением и подсказкой.
   - Полная локализация EN / RU / ZH.

---

## 2. Архитектурные ограничения и лимиты

- Все серверные модули `lib/*.js` строго $< 600$ строк.
- `src/client/50-settings-card.js` строго $\le 350$ строк.
- `lib/client.js` строго $\le 600$ строк.
- Все файлы пакета npm строго $\le 262144$ байт (`npm run pack:check`).
- `preflight.sh` — `FAIL=0`.
- 100% обратная совместимость, 116+ существующих тестов должны остаться зелеными, добавление новых unit-тестов.

