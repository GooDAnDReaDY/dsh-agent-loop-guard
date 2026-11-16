window.__ModuleLoader__.load({
  id: '@goodandready/dsh-agent-loop-guard',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const NS = '@goodandready/dsh-agent-loop-guard';
    const PKG = '@goodandready/dsh-agent-loop-guard';
    const ROW_ID = '@goodandready/dsh-agent-loop-guard';
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID;

    let PrimitivesChevron = null;
    try {
      const prim = require('@deepseek-ai/dsh-client-ui-primitives');
      if (prim && (prim.IconChevronDownOutline14 || prim.IconChevronDown || prim.IconChevronDown16)) {
        PrimitivesChevron = prim.IconChevronDownOutline14 || prim.IconChevronDown || prim.IconChevronDown16;
      }
    } catch (err) {
      console.warn?.('[dsh-agent-loop-guard] primitives unavailable, using SVG fallback:', err?.message || String(err));
    }
    const CSS_STYLES = `
.alg-page { width: 100%; min-width: 0; }
.alg-card { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3); border-radius: 12px; list-style: none; margin-bottom: 12px; overflow: hidden; transition: border-color 0.15s ease; }
.alg-card:hover { border-color: var(--dsw-alias-border-l1, var(--dsw-alias-border-l2)); }
.alg-header-btn { appearance: none; width: 100%; font: inherit; color: inherit; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 12px; display: flex; align-items: center; gap: 12px; padding: 14px 16px; transition: background 0.15s ease; }
.alg-header-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.alg-chevron { margin-left: auto; color: var(--dsw-alias-label-tertiary); display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease; }
.alg-chevron.expanded { transform: rotate(180deg); }
.alg-body { padding: 0 16px 16px; border-top: 1px solid var(--dsw-alias-border-l2); }
.alg-field { display: flex; flex-direction: column; gap: 6px; padding: 8px 0; }
.alg-field label { font-size: 13px; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.alg-input { height: 34px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 0 12px; font-size: 13px; outline: none; transition: border-color 0.15s ease; }
.alg-input:focus { border-color: var(--dsw-alias-brand-primary); }
.alg-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--dsw-alias-label-primary); cursor: pointer; padding: 5px 0; }
.alg-btn-primary { appearance: none; font: inherit; cursor: pointer; border: 0; border-radius: 8px; padding: 6px 16px; font-size: 13px; font-weight: 500; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-inverted, var(--dsw-alias-bg-layer-3)); transition: opacity 0.15s ease; }
.alg-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.alg-btn-primary:disabled { opacity: 0.5; cursor: default; }
.alg-btn-updater { appearance: none; font: inherit; cursor: pointer; border: 0; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 500; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-inverted, var(--dsw-alias-bg-layer-3)); transition: opacity 0.15s ease; }
.alg-btn-updater:hover:not(:disabled) { opacity: 0.9; }
.alg-btn-updater:disabled { opacity: 0.6; cursor: default; }
.alg-btn-ghost { background: transparent; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-tertiary); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease; }
.alg-btn-ghost:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-secondary); }
.alg-presets { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l2); margin-bottom: 8px; flex-wrap: wrap; }
.alg-btn-preset { appearance: none; font: inherit; cursor: pointer; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 3px 10px; font-size: 12px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary); transition: all 0.15s ease; }
.alg-btn-preset:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }
.alg-incident-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 40%, transparent); font-size: 11px; }
`;

    if (typeof document !== 'undefined') {
      const styleId = 'dsh-agent-loop-guard-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.setAttribute('data-dsh-plugin', '@goodandready/dsh-agent-loop-guard');
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
      }
    }
    const en = {
      title: 'Agent Loop Guard', sub: 'Fail-closed tool-call and assistant-output loop limits', version: 'Version',
      updateChecking: 'Checking updates…', updateAvailable: 'Update available: v{v}', upToDate: 'Up to date',
      updateNow: 'Update Now', updateViaPluginsPage: 'Update in Plugins page', updating: 'Updating…',
      updateSuccess: 'Updated to v{v}. Restart DSH service to apply changes.', updateFailed: 'Update failed: {msg}', checkUpdateFailed: 'Check failed',
      telemetryTitle: 'Protection Telemetry', telemetryLoadFailed: 'Failed to load telemetry', totalBlocked: 'Loops Prevented',
      steeredCount: 'Smart Steers', lastViolation: 'Last Incident', noViolations: 'No loop violations detected in current runtime.',
      resetStats: 'Reset Stats', statsResetDone: 'Stats reset', statsResetFailed: 'Failed to reset stats',
      presetsTitle: 'Presets', presetStrict: 'Strict', presetBalanced: 'Balanced', presetAutonomous: 'Autonomous Coding',
      presetApplied: 'Preset {name} applied to form', copyDump: 'Copy Diagnostic Dump', dumpCopied: 'Diagnostic dump copied to clipboard',
      incidentsTitle: 'Recent Incidents (Post-Mortem)', maxToolAttemptsPerTurn: 'Max tool attempts per turn (0 = disabled)',
      maxProgressToolCallsPerTurn: 'Max progress tool calls per turn', maxCallsPerRepeatGroup: 'Max calls per repeat group',
      strictTools: 'Strict tools (comma-separated, lower limit)', strictToolLimit: 'Strict tools limit',
      blockExactDuplicates: 'Block exact duplicate tool calls', dryRunMode: 'Dry-run / Audit mode (log only, do not reject)',
      assistantOutputGuard: 'Assistant output guard', maxRepeatedAssistantLines: 'Max repeated assistant lines',
      maxRepeatedAssistantBlocks: 'Max repeated assistant blocks', maxAssistantBlockChars: 'Max assistant block chars',
      progressToolNames: 'Progress tool names (comma-separated)', pseudoToolCallThreshold: 'Pseudo tool-call loop threshold (turns, 0 = disabled)',
      oscillationDetection: 'Oscillation loop guard (ping-pong cycles)', maxOscillationRepeats: 'Max oscillation repeats (2-4 step cycles)',
      payloadBloatGuard: 'Payload bloat guard (truncate huge outputs)', maxToolResultChars: 'Max tool result characters (0 = disabled)',
      errorThrashingGuard: 'Error thrashing guard (fail-loop detection)', maxConsecutiveFailures: 'Max consecutive failures before thrashing block',
      adaptiveSteering: 'Smart steering (guide agent before hard cancel)', targetQuotaGuard: 'Target quota guard (per-file loop protection)',
      maxUnchangedReadsPerTarget: 'Max unchanged reads per target file', maxReadsPerTarget: 'Max reads per target file per turn',
      maxEditsPerTarget: 'Max edits/writes per target file per turn', maxTargetAttempts: 'Max total operations per target file per turn',
      saving: 'Saving…', ready: 'Save Settings', saved: 'Saved',
    };

    const ru = {
      title: 'Agent Loop Guard', sub: 'Защита от бесконечных циклов инструментов и вывода ассистента', version: 'Версия',
      updateChecking: 'Проверка обновлений…', updateAvailable: 'Доступно обновление: v{v}', upToDate: 'Установлена актуальная версия',
      updateNow: 'Обновить сейчас', updateViaPluginsPage: 'Обновите на вкладке плагинов', updating: 'Обновление…',
      updateSuccess: 'Обновлено до v{v}. Перезапустите службу DSH для применения.', updateFailed: 'Ошибка обновления: {msg}', checkUpdateFailed: 'Не удалось проверить',
      telemetryTitle: 'Телеметрия защиты', telemetryLoadFailed: 'Не удалось загрузить телеметрию', totalBlocked: 'Предотвращено циклов',
      steeredCount: 'Упреждающих подсказок', lastViolation: 'Последний инцидент', noViolations: 'В текущем сеансе циклов не зафиксировано.',
      resetStats: 'Сбросить статистику', statsResetDone: 'Статистика сброшена', statsResetFailed: 'Не удалось сбросить статистику',
      presetsTitle: 'Профили', presetStrict: 'Строгий', presetBalanced: 'Баланс', presetAutonomous: 'Автономный код',
      presetApplied: 'Применен профиль {name}', copyDump: 'Скопировать дамп диагностики', dumpCopied: 'Дамп скопирован в буфер',
      incidentsTitle: 'Журнал инцидентов (Post-Mortem)', maxToolAttemptsPerTurn: 'Макс. попыток инструментов за ход (0 = выкл)',
      maxProgressToolCallsPerTurn: 'Макс. вызовов инструментов прогресса за ход', maxCallsPerRepeatGroup: 'Макс. повторов в группе',
      strictTools: 'Строгие инструменты (через запятую)', strictToolLimit: 'Лимит строгих инструментов',
      blockExactDuplicates: 'Блокировать точные дубликаты вызовов', dryRunMode: 'Режим аудита (логировать, но не блокировать)',
      assistantOutputGuard: 'Защита от циклов текста ассистента', maxRepeatedAssistantLines: 'Макс. повторов одной строки',
      maxRepeatedAssistantBlocks: 'Макс. повторов блока текста', maxAssistantBlockChars: 'Макс. размер блока текста для проверки',
      progressToolNames: 'Инструменты прогресса (через запятую)', pseudoToolCallThreshold: 'Порог циклов псевдовызовов (ходов, 0 = выкл)',
      oscillationDetection: 'Защита от осцилляций (циклов туда-сюда)', maxOscillationRepeats: 'Макс. повторов цикла осцилляции',
      payloadBloatGuard: 'Защита от раздувания результатов (обрезка)', maxToolResultChars: 'Макс. символов результата (0 = выкл)',
      errorThrashingGuard: 'Защита от серий ошибок инструментов', maxConsecutiveFailures: 'Порог серии ошибок перед блокировкой',
      adaptiveSteering: 'Умное наставление (предупреждать перед отменой)', targetQuotaGuard: 'Квоты обращений к файлам (защита от циклов по целям)',
      maxUnchangedReadsPerTarget: 'Макс. повторных чтений неизмененного файла', maxReadsPerTarget: 'Макс. чтений одного файла за ход',
      maxEditsPerTarget: 'Макс. правок одного файла за ход', maxTargetAttempts: 'Макс. всего операций над файлом за ход',
      saving: 'Сохранение…', ready: 'Сохранить настройки', saved: 'Сохранено',
    };

    const zh = {
      title: 'Agent Loop Guard', sub: '工具调用与助手输出防死循环熔断限制', version: '版本',
      updateChecking: '正在检查更新…', updateAvailable: '发现新版本: v{v}', upToDate: '已是最新版本',
      updateNow: '立即更新', updateViaPluginsPage: '请在插件页面更新', updating: '正在更新…',
      updateSuccess: '已更新至 v{v}。请重启 DSH 服务以生效变更。', updateFailed: '更新失败: {msg}', checkUpdateFailed: '检查更新失败',
      telemetryTitle: '防护运行遥测', telemetryLoadFailed: '获取遥测数据失败', totalBlocked: '已拦截死循环',
      steeredCount: '自纠正引导次数', lastViolation: '最近拦截事件', noViolations: '当前运行时未检测到死循环违规。',
      resetStats: '重置统计', statsResetDone: '统计已重置', statsResetFailed: '重置统计失败',
      presetsTitle: '灵敏度预设', presetStrict: '严格', presetBalanced: '平衡', presetAutonomous: '自主编程',
      presetApplied: '已应用预设: {name}', copyDump: '复制诊断数据', dumpCopied: '诊断数据已复制到剪贴板',
      incidentsTitle: '最近拦截事件日志 (Post-Mortem)', maxToolAttemptsPerTurn: '单回合最大工具尝试次数（0 表示禁用）',
      maxProgressToolCallsPerTurn: '单回合最大进度工具调用次数', maxCallsPerRepeatGroup: '同组工具最大重复调用次数',
      strictTools: '严格限制工具（逗号分隔，触发更低阈值）', strictToolLimit: '严格工具调用上限',
      blockExactDuplicates: '立即拦截完全相同的重复工具调用', dryRunMode: '审计模拟模式（仅记录日志，不实际拦截）',
      assistantOutputGuard: '助手文本输出防循环守卫', maxRepeatedAssistantLines: '最大单行重复次数',
      maxRepeatedAssistantBlocks: '最大段落重复次数', maxAssistantBlockChars: '最大段落判定字符数',
      progressToolNames: '进度标记工具（逗号分隔）', pseudoToolCallThreshold: '伪工具调用空转拦截阈值（连续回合数，0 表示禁用）',
      oscillationDetection: '交替循环拦截（乒乓震荡检测）', maxOscillationRepeats: '最大交替循环重复次数（2-4 步序列）',
      payloadBloatGuard: '超大结果防膨胀拦截（截断巨大输出）', maxToolResultChars: '工具结果字符上限（0 表示禁用）',
      errorThrashingGuard: '工具重复报错拦截（错误循环保护）', maxConsecutiveFailures: '连续报错熔断阈值',
      adaptiveSteering: '智能自纠正（熔断前引导修正）', targetQuotaGuard: '目标配额守卫（单文件/目标防死循环）',
      maxUnchangedReadsPerTarget: '单文件无变化最大重复读取次数', maxReadsPerTarget: '单文件最大读取次数',
      maxEditsPerTarget: '单文件最大修改次数', maxTargetAttempts: '单文件总操作次数上限',
      saving: '正在保存…', ready: '保存配置', saved: '配置已保存',
    };
    const DEFAULTS = {
      maxToolAttemptsPerTurn: 64, maxProgressToolCallsPerTurn: 16, progressToolNames: ['todo_write'],
      maxCallsPerRepeatGroup: 5, strictTools: [], strictToolLimit: 3, blockExactDuplicates: true,
      dryRunMode: false, assistantOutputGuard: true, maxRepeatedAssistantLines: 5,
      maxRepeatedAssistantBlocks: 5, maxAssistantBlockChars: 16384, pseudoToolCallThreshold: 3,
      oscillationDetection: true, maxOscillationRepeats: 3, payloadBloatGuard: true, maxToolResultChars: 65536,
      errorThrashingGuard: true, maxConsecutiveFailures: 4, adaptiveSteering: true,
      targetQuotaGuard: true, maxUnchangedReadsPerTarget: 3, maxReadsPerTarget: 6,
      maxEditsPerTarget: 8, maxTargetAttempts: 12,
    };

    const CLIENT_PRESETS = {
      strict: {
        maxToolAttemptsPerTurn: 10, maxProgressToolCallsPerTurn: 3, maxCallsPerRepeatGroup: 2,
        strictToolLimit: 1, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 2,
        errorThrashingGuard: true, maxConsecutiveFailures: 3, payloadBloatGuard: true, maxToolResultChars: 32768,
        pseudoToolCallThreshold: 2, adaptiveSteering: true, targetQuotaGuard: true,
        maxUnchangedReadsPerTarget: 2, maxReadsPerTarget: 4, maxEditsPerTarget: 5, maxTargetAttempts: 8,
      },
      balanced: {
        maxToolAttemptsPerTurn: 16, maxProgressToolCallsPerTurn: 6, maxCallsPerRepeatGroup: 3,
        strictToolLimit: 2, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 3,
        errorThrashingGuard: true, maxConsecutiveFailures: 4, payloadBloatGuard: true, maxToolResultChars: 65536,
        pseudoToolCallThreshold: 3, adaptiveSteering: true, targetQuotaGuard: true,
        maxUnchangedReadsPerTarget: 3, maxReadsPerTarget: 6, maxEditsPerTarget: 8, maxTargetAttempts: 12,
      },
      autonomous: {
        maxToolAttemptsPerTurn: 32, maxProgressToolCallsPerTurn: 12, maxCallsPerRepeatGroup: 5,
        strictToolLimit: 3, blockExactDuplicates: true, oscillationDetection: true, maxOscillationRepeats: 4,
        errorThrashingGuard: true, maxConsecutiveFailures: 6, payloadBloatGuard: true, maxToolResultChars: 131072,
        pseudoToolCallThreshold: 4, adaptiveSteering: true, targetQuotaGuard: true,
        maxUnchangedReadsPerTarget: 5, maxReadsPerTarget: 10, maxEditsPerTarget: 12, maxTargetAttempts: 20,
      },
    };
    function IncidentTelemetryPanel({ telemetry, tt, onCopyDump, onResetTelemetry }) {
      return React.createElement('div', {
        style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 2%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, tt('telemetryTitle')),
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            telemetry.totalViolations > 0 && React.createElement('button', { className: 'alg-btn-ghost', onClick: onCopyDump }, tt('copyDump')),
            (telemetry.totalViolations > 0 || (telemetry.incidents && telemetry.incidents.length > 0)) && React.createElement('button', { className: 'alg-btn-ghost', onClick: onResetTelemetry }, tt('resetStats'))
          )
        ),
        React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
          telemetry.error
            ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, telemetry.error)
            : (telemetry.totalViolations > 0 || telemetry.steeredCount > 0)
              ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  React.createElement('div', { style: { display: 'flex', gap: 16 } },
                    React.createElement('div', null, tt('totalBlocked') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-state-warn-primary)' } }, telemetry.totalViolations)),
                    React.createElement('div', null, tt('steeredCount') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-brand-primary)' } }, telemetry.steeredCount || 0))
                  ),
                  telemetry.lastViolation && React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
                    tt('lastViolation') + ': ' + telemetry.lastViolation.code + ' (' + telemetry.lastViolation.tool + ')'
                  ),
                  telemetry.incidents && telemetry.incidents.length > 0 && React.createElement('div', { style: { marginTop: 6, borderTop: '1px solid var(--dsw-alias-border-l2)', paddingTop: 6 } },
                    React.createElement('div', { style: { fontWeight: 500, marginBottom: 4 } }, tt('incidentsTitle')),
                    telemetry.incidents.slice(0, 4).map((inc, i) => React.createElement('div', { key: inc.id || i, className: 'alg-incident-row' },
                      React.createElement('span', { style: { fontWeight: 500, color: inc.code === 'LOOP_GUARD_STEER' ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-state-error-primary)' } }, inc.code),
                      React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, inc.tool)
                    ))
                  )
                )
              : React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, tt('noViolations'))
        )
      );
    }
    function PluginCard({ ctx: _ctx, t, bare, ...props }) {
      const isBare = Boolean(bare || props?.view === 'page');
      const [expanded, setExpanded] = React.useState(false);
      const isExpanded = Boolean(isBare || expanded);
      const [draft, setDraft] = React.useState({ ...DEFAULTS, progressToolNamesText: 'todo_write', strictToolsText: '' });
      const [status, setStatus] = React.useState('loading');
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState('');

      const [updateState, setUpdateState] = React.useState({
        checking: false, updateAvailable: false, currentVersion: '', latestVersion: '',
        updating: false, notice: '', error: '', canAutoUpdate: true, isDesktop: false,
      });

      const [telemetry, setTelemetry] = React.useState({ totalViolations: 0, steeredCount: 0, byCode: {}, lastViolation: null, incidents: [] });

      const scopeRef = React.useRef(null);
      if (!scopeRef.current && _ctx && _ctx.configForms) {
        try { scopeRef.current = _ctx.configForms.get(NS); } catch (e) { scopeRef.current = null; }
      }
      const scope = scopeRef.current;

      const [, setLocaleTick] = React.useState(0);
      React.useEffect(() => {
        if (typeof _ctx?.locale?.subscribe === 'function') return _ctx.locale.subscribe(() => setLocaleTick((c) => c + 1));
      }, []);

      const getActiveLocale = () => {
        const snap = typeof _ctx?.locale?.getLocale === 'function' ? _ctx.locale.getLocale()
          : (typeof _ctx?.locale?.getSnapshot === 'function' ? _ctx.locale.getSnapshot() : null);
        const loc = typeof snap === 'string' ? snap : (snap?.active || snap?.locale || snap?.id);
        return loc || (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en');
      };
      const locStr = String(getActiveLocale()).toLowerCase();
      const currentLang = locStr.startsWith('zh') ? 'zh' : (locStr.startsWith('ru') ? 'ru' : 'en');
      const dict = currentLang === 'zh' ? zh : (currentLang === 'ru' ? ru : en);
      const tt = (k, params) => {
        let str = (typeof t === 'function' ? t(k) : null) || dict[k] || en[k] || k;
        if (params && typeof params === 'object') {
          for (const [pk, pv] of Object.entries(params)) {
            str = str.replace(new RegExp('\\{' + pk + '\\}', 'g'), String(pv));
          }
        }
        return str;
      };

      React.useEffect(() => {
        if (!scope) { setStatus('unavailable'); return; }
        let cancelled = false;
        const syncFromSnapshot = (snap) => {
          if (!snap || typeof snap !== 'object') return;
          if ('status' in snap) {
            if (snap.status === 'loading') { setStatus('loading'); return; }
            if (snap.status === 'unavailable') { setStatus('unavailable'); return; }
          }
          const vals = snap.value !== undefined ? snap.value : (snap.values !== undefined ? snap.values : snap);
          if (vals && typeof vals === 'object') {
            const names = Array.isArray(vals.progressToolNames) ? vals.progressToolNames : DEFAULTS.progressToolNames;
            const strict = Array.isArray(vals.strictTools) ? vals.strictTools : DEFAULTS.strictTools;
            setDraft((d) => ({
              ...d, ...DEFAULTS, ...vals,
              progressToolNamesText: names.join(', '),
              strictToolsText: strict.join(', '),
            }));
          }
          setStatus('ready');
        };

        try {
          if (typeof scope.getSnapshot === 'function') syncFromSnapshot(scope.getSnapshot());
          else if (typeof scope.get === 'function') Promise.resolve(scope.get()).then((s) => { if (!cancelled) syncFromSnapshot(s); }).catch(() => { if (!cancelled) setStatus('unavailable'); });
          else setStatus('unavailable');
        } catch (_) { if (!cancelled) setStatus('unavailable'); }

        const unsub = typeof scope.subscribe === 'function' ? scope.subscribe(() => {
          if (!cancelled && typeof scope.getSnapshot === 'function') { try { syncFromSnapshot(scope.getSnapshot()); } catch (err) { void err; } }
        }) : null;

        return () => { cancelled = true; if (typeof unsub === 'function') unsub(); };
      }, [scope]);

      React.useEffect(() => {
        if (!isExpanded) return;
        let cancelled = false;

        (async () => {
          try {
            const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/update');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (cancelled) return;
            setUpdateState((s) => ({
              ...s, checking: false, updateAvailable: Boolean(data.updateAvailable),
              currentVersion: data.currentVersion || '', latestVersion: data.latestVersion || '',
              updating: false, notice: '', error: '',
              canAutoUpdate: data.canAutoUpdate !== false, isDesktop: !!data.isDesktop,
            }));
          } catch (err) {
            if (cancelled) return;
            setUpdateState((s) => ({ ...s, checking: false, error: tt('checkUpdateFailed') }));
          }
        })();

        (async () => {
          try {
            const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/telemetry');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (cancelled) return;
            setTelemetry({
              totalViolations: Number(data.totalViolations) || 0,
              steeredCount: Number(data.steeredCount) || 0,
              byCode: data.byCode || {},
              lastViolation: data.lastViolation || null,
              incidents: Array.isArray(data.incidents) ? data.incidents : [],
              error: null,
            });
          } catch (err) {
            if (cancelled) return;
            setTelemetry((t) => ({ ...t, error: tt('telemetryLoadFailed') }));
          }
        })();

        return () => { cancelled = true; };
      }, [isExpanded]);

      async function onSave() {
        if (!scope || saving) return;
        setSaving(true);
        setMsg('');
        const names = draft.progressToolNamesText.split(',').map((s) => s.trim()).filter(Boolean);
        const strictList = draft.strictToolsText.split(',').map((s) => s.trim()).filter(Boolean);
        const payload = {
          maxToolAttemptsPerTurn: Number(draft.maxToolAttemptsPerTurn) || 0, maxProgressToolCallsPerTurn: Number(draft.maxProgressToolCallsPerTurn) || 16,
          maxCallsPerRepeatGroup: Number(draft.maxCallsPerRepeatGroup) || 5, strictTools: strictList, strictToolLimit: Number(draft.strictToolLimit) || 3,
          blockExactDuplicates: draft.blockExactDuplicates !== false, dryRunMode: Boolean(draft.dryRunMode),
          assistantOutputGuard: draft.assistantOutputGuard !== false, maxRepeatedAssistantLines: Number(draft.maxRepeatedAssistantLines) || 5,
          maxRepeatedAssistantBlocks: Number(draft.maxRepeatedAssistantBlocks) || 5, maxAssistantBlockChars: Number(draft.maxAssistantBlockChars) || 16384,
          pseudoToolCallThreshold: Number.isFinite(Number(draft.pseudoToolCallThreshold)) ? Number(draft.pseudoToolCallThreshold) : 3,
          oscillationDetection: draft.oscillationDetection !== false, maxOscillationRepeats: Number(draft.maxOscillationRepeats) || 3,
          payloadBloatGuard: draft.payloadBloatGuard !== false, progressToolNames: names.length ? names : ['todo_write'],
          maxToolResultChars: Number.isFinite(Number(draft.maxToolResultChars)) && Number(draft.maxToolResultChars) >= 0 ? Number(draft.maxToolResultChars) : 65536,
          errorThrashingGuard: draft.errorThrashingGuard !== false, maxConsecutiveFailures: Number(draft.maxConsecutiveFailures) || 4,
          adaptiveSteering: draft.adaptiveSteering !== false, targetQuotaGuard: draft.targetQuotaGuard !== false,
          maxUnchangedReadsPerTarget: Number(draft.maxUnchangedReadsPerTarget) || 3,
          maxReadsPerTarget: Number(draft.maxReadsPerTarget) || 6,
          maxEditsPerTarget: Number(draft.maxEditsPerTarget) || 8,
          maxTargetAttempts: Number(draft.maxTargetAttempts) || 12,
        };
        const errs = [];
        for (const [k, v] of Object.entries(payload)) {
          try { await scope.set(k, v); } catch (e) { errs.push(k + ': ' + (e && e.message || String(e))); }
        }
        setSaving(false);
        setMsg(errs.length ? errs.join('; ') : tt('saved'));
      }

      function applyPreset(name) {
        if (!CLIENT_PRESETS[name]) return;
        setDraft((d) => ({ ...d, ...CLIENT_PRESETS[name] }));
        setMsg(tt('presetApplied', { name: tt('preset' + name.charAt(0).toUpperCase() + name.slice(1)) }));
      }

      function onCopyDump() {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
          setMsg(tt('dumpCopied'));
        } catch (e) { setMsg(String(e)); }
      }

      async function onTriggerUpdate() {
        if (updateState.updating) return;
        setUpdateState((s) => ({ ...s, updating: true, error: '', notice: '' }));
        try {
          const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/update', {
            method: 'POST', headers: { 'x-dsh-plugin-update': '1' },
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'HTTP ' + res.status);
          setUpdateState((s) => ({
            ...s, updating: false, updateAvailable: false,
            currentVersion: data.updatedVersion || s.latestVersion,
            notice: tt('updateSuccess', { v: data.updatedVersion || s.latestVersion }),
          }));
        } catch (err) { setUpdateState((s) => ({ ...s, updating: false, error: tt('updateFailed', { msg: err.message || String(err) }) })); }
      }

      async function onResetTelemetry() {
        try {
          const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/telemetry', {
            method: 'POST', headers: { 'x-dsh-loop-guard': '1' },
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setTelemetry({ totalViolations: 0, steeredCount: 0, byCode: {}, lastViolation: null, incidents: [], error: null });
          setMsg(tt('statsResetDone'));
        } catch (err) { setMsg(tt('statsResetFailed')); }
      }

      const renderChevron = () => {
        if (PrimitivesChevron) {
          return React.createElement(PrimitivesChevron, {
            className: 'alg-chevron' + (expanded ? ' expanded' : ''),
            style: { width: 14, height: 14, color: 'inherit' }
          });
        }
        return React.createElement('svg', {
          className: 'alg-chevron' + (expanded ? ' expanded' : ''),
          width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          style: { flexShrink: 0 }
        }, React.createElement('polyline', { points: '6 9 12 15 18 9' }));
      };

      const field = (key, input) => {
        const id = 'alg-' + key;
        const linkedInput = React.isValidElement && React.isValidElement(input)
          ? React.cloneElement(input, { id }) : input;
        return React.createElement('div', { key, className: 'alg-field' },
          React.createElement('label', { htmlFor: id }, tt(key)),
          linkedInput
        );
      };

      const num = (k) => React.createElement('input', { type: 'number', className: 'alg-input', value: draft[k], onChange: (e) => setDraft((d) => ({ ...d, [k]: e.target.value })) });
      const str = (k) => React.createElement('input', { type: 'text', className: 'alg-input', value: draft[k], onChange: (e) => setDraft((d) => ({ ...d, [k]: e.target.value })) });
      const check = (k) => React.createElement('label', { key: k, className: 'alg-checkbox-label' }, React.createElement('input', { type: 'checkbox', checked: !!draft[k], onChange: (e) => setDraft((d) => ({ ...d, [k]: e.target.checked })) }), tt(k));

      const header = React.createElement('button', {
        className: 'alg-header-btn', onClick: () => setExpanded(!expanded), 'aria-expanded': expanded,
      },
        React.createElement('span', { style: { display: 'flex', flexDirection: 'column' } },
          React.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 } },
            tt('title'),
            React.createElement('span', { style: { fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent)', color: 'var(--dsw-alias-brand-primary)' } }, updateState.currentVersion ? 'v' + updateState.currentVersion : (updateState.checking ? '…' : '—'))
          ),
          React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, tt('sub'))
        ),
        renderChevron()
      );

      const body = React.createElement('div', { className: 'alg-body' },
        React.createElement('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' }
        },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } },
                tt('version') + ': ' + (updateState.currentVersion ? 'v' + updateState.currentVersion : '—')
              ),
              React.createElement('span', {
                style: {
                  fontSize: 11, padding: '1px 6px', borderRadius: 4,
                  background: updateState.updateAvailable ? 'color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent)' : 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 15%, transparent)',
                  color: updateState.updateAvailable ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-state-success-primary)',
                }
              }, updateState.checking ? tt('updateChecking') : (updateState.updateAvailable ? tt('updateAvailable', { v: updateState.latestVersion }) : (updateState.currentVersion ? tt('upToDate') : '—')))
            ),
            updateState.error && React.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12 } }, updateState.error)
          ),
          updateState.updateAvailable && (
            (updateState.isDesktop || !updateState.canAutoUpdate)
              ? React.createElement('span', { className: 'alg-updater-hint', style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, tt('updateViaPluginsPage'))
              : React.createElement('button', { className: 'alg-btn-updater', onClick: onTriggerUpdate, disabled: updateState.updating }, updateState.updating ? tt('updating') : tt('updateNow'))
          )
        ),
        updateState.notice && React.createElement('div', {
          style: { padding: '8px 12px', marginBottom: 12, background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)', color: 'var(--dsw-alias-state-success-primary)', borderRadius: 6, fontSize: 12, border: '1px solid color-mix(in srgb, var(--dsw-alias-state-success-primary) 20%, transparent)' }
        }, updateState.notice),

        React.createElement('div', { className: 'alg-presets' },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: 'var(--dsw-alias-label-secondary)', marginRight: 4 } }, tt('presetsTitle') + ':'),
          React.createElement('button', { type: 'button', className: 'alg-btn-preset', onClick: () => applyPreset('strict') }, tt('presetStrict')),
          React.createElement('button', { type: 'button', className: 'alg-btn-preset', onClick: () => applyPreset('balanced') }, tt('presetBalanced')),
          React.createElement('button', { type: 'button', className: 'alg-btn-preset', onClick: () => applyPreset('autonomous') }, tt('presetAutonomous'))
        ),

        React.createElement(IncidentTelemetryPanel, { telemetry, tt, onCopyDump, onResetTelemetry }),

        field('maxToolAttemptsPerTurn', num('maxToolAttemptsPerTurn')),
        field('maxProgressToolCallsPerTurn', num('maxProgressToolCallsPerTurn')),
        field('maxCallsPerRepeatGroup', num('maxCallsPerRepeatGroup')),
        field('strictTools', str('strictToolsText')),
        field('strictToolLimit', num('strictToolLimit')),
        check('blockExactDuplicates'),
        check('dryRunMode'),
        check('assistantOutputGuard'),
        field('maxRepeatedAssistantLines', num('maxRepeatedAssistantLines')),
        field('maxRepeatedAssistantBlocks', num('maxRepeatedAssistantBlocks')),
        field('maxAssistantBlockChars', num('maxAssistantBlockChars')),
        field('progressToolNames', str('progressToolNamesText')),
        field('pseudoToolCallThreshold', num('pseudoToolCallThreshold')),
        check('oscillationDetection'),
        field('maxOscillationRepeats', num('maxOscillationRepeats')),
        check('payloadBloatGuard'),
        field('maxToolResultChars', num('maxToolResultChars')),
        check('errorThrashingGuard'),
        field('maxConsecutiveFailures', num('maxConsecutiveFailures')),
        check('adaptiveSteering'),
        check('targetQuotaGuard'),
        field('maxUnchangedReadsPerTarget', num('maxUnchangedReadsPerTarget')),
        field('maxReadsPerTarget', num('maxReadsPerTarget')),
        field('maxEditsPerTarget', num('maxEditsPerTarget')),
        field('maxTargetAttempts', num('maxTargetAttempts')),

        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: 10 }
        },
          React.createElement('button', {
            className: 'alg-btn-primary', onClick: onSave, disabled: saving || status !== 'ready',
          }, saving ? tt('saving') : tt('ready')),
          msg && React.createElement('span', { style: { fontSize: 13, color: msg.includes(';') ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-success-primary)' } }, msg)
        )
      );

      if (isBare) return React.createElement('div', { className: 'alg-page' }, body);
      return React.createElement('li', { className: 'alg-card' }, header, expanded && body);
    }

    function PluginItem(props) {
      if (props && props.view === 'summary') {
        return React.createElement('div', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, en.sub);
      }
      return React.createElement(PluginCard, { ...props, bare: Boolean(props && (props.bare || props.view === 'page')) });
    }
    exports.inject = ['slots', 'configForms', 'locale'];
    exports.apply = function apply(ctx) {
      if (typeof ctx.locale?.register === 'function') {
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-agent-loop-guard: locale');
        } else {
          ctx.locale.register(NS, { en, zh });
        }
      }

      function registerSlotWhenReady(slotName, registerFn) {
        if (!ctx.slots) return;
        if (typeof ctx.slots.inject === 'function') {
          try {
            ctx.slots.inject(slotName, () => {
              try {
                return registerFn();
              } catch (err) {
                console.warn('[' + NS + '] Error registering slot ' + slotName + ':', err);
              }
            });
            return;
          } catch (err) {
            console.warn('[' + NS + '] Failed to inject slot ' + slotName + ':', err);
          }
        }
        if (typeof ctx.slots.register === 'function') {
          try {
            registerFn();
          } catch (err) {
            console.warn('[' + NS + '] Failed direct registration for ' + slotName + ':', err);
          }
        }
      }

      registerSlotWhenReady('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
            order: 10,
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(PluginItem, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );

      registerSlotWhenReady('plugins.item', () =>
        ctx.slots.register(
          {
            name: 'plugins.item',
            id: ROW_ID,
            order: 10,
            label: () => 'Agent Loop Guard',
            locale: NS,
            inject: () => ({ ctx }),
          },
          (props) => React.createElement(PluginCard, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );

    };
    return module.exports;
  },
});
