window.__ModuleLoader__.load({
  id: '@goodandready/dsh-agent-loop-guard',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const NS = '@goodandready/dsh-agent-loop-guard';
    // Row seat on the Plugins page: the row's "configure" control opens this
    // entry, keyed `<package name>#<row id>` exactly as cordis.patch.yml
    // declares the row (kernel: rowConfigKey(bundle, rowId)).
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
      /* bestEffort */
      console.warn?.('[dsh-agent-loop-guard] primitives unavailable, using SVG fallback:', err?.message || String(err));
    }

    const CSS_STYLES = `
/* Row seat on the Plugins page: the page owns the frame and the padding. */
.alg-page {
  width: 100%;
  min-width: 0;
}
.alg-card {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  list-style: none;
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}
.alg-card:hover {
  border-color: var(--dsw-alias-border-l1, var(--dsw-alias-border-l2));
}
.alg-header-btn {
  appearance: none;
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  transition: background 0.15s ease;
}
.alg-header-btn:hover {
  background: var(--dsw-alias-bg-hover, var(--dsw-alias-bg-layer-hover));
}
.alg-chevron {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}
.alg-chevron.expanded {
  transform: rotate(180deg);
}
.alg-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.alg-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0;
}
.alg-field label {
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.alg-input {
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}
.alg-input:focus {
  border-color: var(--dsw-alias-accent-primary);
}
.alg-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  padding: 6px 0;
}
.alg-btn-primary {
  height: 34px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  background: var(--dsw-alias-accent-primary);
  color: var(--dsw-alias-label-inverse);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.alg-btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}
.alg-btn-updater {
  padding: 6px 14px;
  border-radius: 6px;
  background: var(--dsw-alias-accent-primary);
  color: var(--dsw-alias-label-inverse);
  border: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.alg-btn-updater:disabled {
  opacity: 0.6;
  cursor: default;
}
.alg-btn-ghost {
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-tertiary);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.alg-btn-ghost:hover {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-label-secondary);
}
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
      title: 'Agent Loop Guard',
      sub: 'Fail-closed tool-call and assistant-output loop limits',
      version: 'Version',
      updateChecking: 'Checking updates…',
      updateAvailable: 'Update available: v{v}',
      upToDate: 'Up to date',
      updateNow: 'Update Now',
      updating: 'Updating…',
      updateSuccess: 'Updated to v{v}. Restart DSH service to apply changes.',
      updateFailed: 'Update failed: {msg}',
      checkUpdateFailed: 'Check failed',
      telemetryTitle: 'Protection Telemetry',
      telemetryLoadFailed: 'Failed to load telemetry',
      totalBlocked: 'Loops Prevented',
      lastViolation: 'Last Incident',
      noViolations: 'No loop violations detected in current runtime.',
      resetStats: 'Reset Stats',
      statsResetDone: 'Stats reset',
      statsResetFailed: 'Failed to reset stats',
      maxToolAttemptsPerTurn: 'Max tool attempts per turn (0 = disabled)',
      maxProgressToolCallsPerTurn: 'Max progress tool calls per turn',
      maxCallsPerRepeatGroup: 'Max calls per repeat group',
      strictTools: 'Strict tools (comma-separated, lower limit)',
      strictToolLimit: 'Strict tools limit',
      blockExactDuplicates: 'Block exact duplicate tool calls',
      dryRunMode: 'Dry-run / Audit mode (log only, do not reject)',
      assistantOutputGuard: 'Assistant output guard',
      maxRepeatedAssistantLines: 'Max repeated assistant lines',
      maxRepeatedAssistantBlocks: 'Max repeated assistant blocks',
      maxAssistantBlockChars: 'Max assistant block chars',
      progressToolNames: 'Progress tool names (comma-separated)',
      saving: 'Saving…',
      ready: 'Save Settings',
      saved: 'Saved',
    };

    const zh = {
      title: 'Agent Loop Guard',
      sub: '工具调用与助手输出防死循环熔断限制',
      version: '版本',
      updateChecking: '正在检查更新…',
      updateAvailable: '发现新版本: v{v}',
      upToDate: '已是最新版本',
      updateNow: '立即更新',
      updating: '正在更新…',
      updateSuccess: '已更新至 v{v}。请重启 DSH 服务以生效变更。',
      updateFailed: '更新失败: {msg}',
      checkUpdateFailed: '检查更新失败',
      telemetryTitle: '防护运行遥测',
      telemetryLoadFailed: '获取遥测数据失败',
      totalBlocked: '已拦截死循环',
      lastViolation: '最近拦截事件',
      noViolations: '当前运行时未检测到死循环违规。',
      resetStats: '重置统计',
      statsResetDone: '统计已重置',
      statsResetFailed: '重置统计失败',
      maxToolAttemptsPerTurn: '单回合最大工具尝试次数（0 表示禁用）',
      maxProgressToolCallsPerTurn: '单回合最大进度工具调用次数',
      maxCallsPerRepeatGroup: '同组工具最大重复调用次数',
      strictTools: '严格限制工具（逗号分隔，触发更低阈值）',
      strictToolLimit: '严格工具调用上限',
      blockExactDuplicates: '立即拦截完全相同的重复工具调用',
      dryRunMode: '审计模拟模式（仅记录日志，不实际拦截）',
      assistantOutputGuard: '助手文本输出防循环守卫',
      maxRepeatedAssistantLines: '最大单行重复次数',
      maxRepeatedAssistantBlocks: '最大段落重复次数',
      maxAssistantBlockChars: '最大段落判定字符数',
      progressToolNames: '进度标记工具（逗号分隔）',
      saving: '正在保存…',
      ready: '保存配置',
      saved: '配置已保存',
    };

    const DEFAULTS = {
      maxToolAttemptsPerTurn: 64,
      maxProgressToolCallsPerTurn: 16,
      progressToolNames: ['todo_write'],
      maxCallsPerRepeatGroup: 5,
      strictTools: [],
      strictToolLimit: 3,
      blockExactDuplicates: true,
      dryRunMode: false,
      assistantOutputGuard: true,
      maxRepeatedAssistantLines: 5,
      maxRepeatedAssistantBlocks: 5,
      maxAssistantBlockChars: 16384,
    };

    function PluginCard({ ctx: _ctx, t, bare }) {
      const [expanded, setExpanded] = React.useState(false);
      const [draft, setDraft] = React.useState({
        ...DEFAULTS,
        progressToolNamesText: 'todo_write',
        strictToolsText: '',
      });
      const [status, setStatus] = React.useState('loading');
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState('');

      // Updater state
      const [updateState, setUpdateState] = React.useState({
        checking: false,
        updateAvailable: false,
        currentVersion: '',
        latestVersion: '',
        updating: false,
        notice: '',
        error: '',
      });

      // Telemetry state
      const [telemetry, setTelemetry] = React.useState({
        totalViolations: 0,
        byCode: {},
        lastViolation: null,
      });

      const scopeRef = React.useRef(null);
      if (!scopeRef.current && _ctx && _ctx.settingsScope) {
        try { scopeRef.current = _ctx.settingsScope.bind({ namespace: NS }); } catch (e) { scopeRef.current = null; }
      }
      const scope = scopeRef.current;

      const [, setLocaleTick] = React.useState(0);
      React.useEffect(() => {
        if (typeof _ctx?.locale?.subscribe === 'function') {
          return _ctx.locale.subscribe(() => setLocaleTick((c) => c + 1));
        }
      }, []);

      const getActiveLocale = () => {
        const snap = typeof _ctx?.locale?.getLocale === 'function'
          ? _ctx.locale.getLocale()
          : (typeof _ctx?.locale?.getSnapshot === 'function' ? _ctx.locale.getSnapshot() : null);
        const loc = typeof snap === 'string' ? snap : (snap?.locale || snap?.id);
        if (loc) return loc;
        return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
      };
      const currentLang = String(getActiveLocale()).toLowerCase().startsWith('zh') ? 'zh' : 'en';
      const dict = currentLang === 'zh' ? zh : en;
      const tt = (k, params) => {
        let str = (typeof t === 'function' ? t(k) : null) || dict[k] || en[k] || k;
        if (params && typeof params === 'object') {
          for (const [pk, pv] of Object.entries(params)) {
            str = str.replace(new RegExp('\\{' + pk + '\\}', 'g'), String(pv));
          }
        }
        return str;
      };

      // Load settings
      React.useEffect(() => {
        if (!scope) { setStatus('unavailable'); return; }
        let cancelled = false;
        (async () => {
          try {
            const snap = await scope.get();
            if (cancelled) return;
            if (snap && typeof snap === 'object' && 'status' in snap) {
              if (snap.status === 'loading') { setStatus('loading'); return; }
              if (snap.status === 'unavailable') { setStatus('unavailable'); return; }
            }
            const vals = snap && snap.values ? snap.values : snap;
            if (vals && typeof vals === 'object') {
              const names = Array.isArray(vals.progressToolNames) ? vals.progressToolNames : DEFAULTS.progressToolNames;
              const strict = Array.isArray(vals.strictTools) ? vals.strictTools : DEFAULTS.strictTools;
              setDraft((d) => ({
                ...d,
                ...DEFAULTS,
                ...vals,
                progressToolNamesText: names.join(', '),
                strictToolsText: strict.join(', '),
              }));
            }
            setStatus('ready');
          } catch (e) {
            if (!cancelled) setStatus('unavailable');
          }
        })();
        return () => { cancelled = true; };
      }, [scope]);

      // Check updater and telemetry on expand
      React.useEffect(() => {
        if (!expanded) return;
        let cancelled = false;

        // Fetch update status
        (async () => {
          setUpdateState((s) => ({ ...s, checking: true, error: '', notice: '' }));
          try {
            const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/update');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (cancelled) return;
            setUpdateState((s) => ({
              ...s,
              checking: false,
              currentVersion: data.currentVersion || '',
              latestVersion: data.latestVersion || '',
              updateAvailable: !!data.updateAvailable,
            }));
          } catch (err) {
            if (cancelled) return;
            setUpdateState((s) => ({ ...s, checking: false, error: tt('checkUpdateFailed') }));
          }
        })();

        // Fetch telemetry
        (async () => {
          try {
            const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/telemetry');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (cancelled) return;
            setTelemetry({
              totalViolations: Number(data.totalViolations) || 0,
              byCode: data.byCode || {},
              lastViolation: data.lastViolation || null,
              error: null,
            });
          } catch (err) {
            if (cancelled) return;
            setTelemetry((t) => ({ ...t, error: tt('telemetryLoadFailed') }));
          }
        })();

        return () => { cancelled = true; };
      }, [expanded]);

      async function onSave() {
        if (!scope) { setMsg('Settings unavailable'); return; }
        setSaving(true); setMsg('');
        const names = String(draft.progressToolNamesText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const strictNames = String(draft.strictToolsText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const maxToolAttempts = Number(draft.maxToolAttemptsPerTurn);
        const payload = {
          maxToolAttemptsPerTurn: Number.isFinite(maxToolAttempts) && maxToolAttempts >= 0 ? maxToolAttempts : 64,
          maxProgressToolCallsPerTurn: Number(draft.maxProgressToolCallsPerTurn) || 16,
          maxCallsPerRepeatGroup: Number(draft.maxCallsPerRepeatGroup) || 5,
          strictToolLimit: Number(draft.strictToolLimit) || 3,
          strictTools: strictNames,
          blockExactDuplicates: !!draft.blockExactDuplicates,
          dryRunMode: !!draft.dryRunMode,
          assistantOutputGuard: !!draft.assistantOutputGuard,
          maxRepeatedAssistantLines: Number(draft.maxRepeatedAssistantLines) || 5,
          maxRepeatedAssistantBlocks: Number(draft.maxRepeatedAssistantBlocks) || 5,
          maxAssistantBlockChars: Number(draft.maxAssistantBlockChars) || 16384,
          progressToolNames: names.length ? names : ['todo_write'],
        };
        const errs = [];
        for (const [k, v] of Object.entries(payload)) {
          try { await scope.set(k, v); } catch (e) { errs.push(k + ': ' + (e && e.message || String(e))); }
        }
        setSaving(false);
        setMsg(errs.length ? errs.join('; ') : tt('saved'));
      }

      async function onTriggerUpdate() {
        if (updateState.updating) return;
        setUpdateState((s) => ({ ...s, updating: true, error: '', notice: '' }));
        try {
          const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/update', {
            method: 'POST',
            headers: { 'x-dsh-plugin-update': '1' },
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || 'Update failed with HTTP ' + res.status);
          }
          setUpdateState((s) => ({
            ...s,
            updating: false,
            updateAvailable: false,
            currentVersion: data.updatedVersion || s.latestVersion,
            notice: tt('updateSuccess', { v: data.updatedVersion || s.latestVersion }),
          }));
        } catch (err) {
          setUpdateState((s) => ({
            ...s,
            updating: false,
            error: tt('updateFailed', { msg: err.message || String(err) }),
          }));
        }
      }

      async function onResetTelemetry() {
        try {
          const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/telemetry', {
            method: 'POST',
            headers: { 'x-dsh-loop-guard': '1' },
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          setTelemetry({ totalViolations: 0, byCode: {}, lastViolation: null, error: null });
          setMsg(tt('statsResetDone'));
        } catch (err) {
          setMsg(tt('statsResetFailed'));
        }
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
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { flexShrink: 0 }
        }, React.createElement('polyline', { points: '6 9 12 15 18 9' }));
      };

      const field = (key, input) => {
        const id = 'alg-' + key;
        const linkedInput = React.isValidElement && React.isValidElement(input)
          ? React.cloneElement(input, { id })
          : input;
        return React.createElement('div', { className: 'alg-field' },
          React.createElement('label', { htmlFor: id }, tt(key)),
          linkedInput
        );
      };

      const num = (key) => React.createElement('input', {
        type: 'number',
        className: 'alg-input',
        value: draft[key],
        onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
      });

      const str = (key) => React.createElement('input', {
        type: 'text',
        className: 'alg-input',
        value: draft[key],
        onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
      });

      const check = (key) => React.createElement('label', { className: 'alg-checkbox-label' },
        React.createElement('input', {
          type: 'checkbox', checked: !!draft[key],
          onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))
        }),
        tt(key)
      );

      const header = React.createElement('button', {
          className: 'alg-header-btn',
          onClick: () => setExpanded(!expanded),
          'aria-expanded': expanded,
        },
          React.createElement('span', { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 } },
              tt('title'),
              React.createElement('span', { style: { fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: 'color-mix(in srgb, var(--dsw-alias-accent-primary) 15%, transparent)', color: 'var(--dsw-alias-accent-primary)' } }, updateState.currentVersion ? 'v' + updateState.currentVersion : (updateState.checking ? '…' : '—'))
            ),
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, tt('sub'))
          ),
          renderChevron()
        );
        const body = React.createElement('div', {
          className: 'alg-body',
        },
          // Section: One-Click Updater
          React.createElement('div', {
            style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }
          },
            React.createElement('div', { style: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, tt('version') + ': ' + (updateState.currentVersion || (updateState.checking ? '…' : '—'))),
              updateState.checking && React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, tt('updateChecking')),
              !updateState.checking && updateState.updateAvailable && React.createElement('span', { style: { color: 'var(--dsw-alias-status-warning)', fontWeight: 600, fontSize: 12 } }, tt('updateAvailable', { v: updateState.latestVersion })),
              !updateState.checking && !updateState.updateAvailable && !updateState.error && React.createElement('span', { style: { color: 'var(--dsw-alias-status-success)', fontSize: 12 } }, '✓ ' + tt('upToDate')),
              updateState.error && React.createElement('span', { style: { color: 'var(--dsw-alias-status-danger)', fontSize: 12 } }, updateState.error)
            ),
            updateState.updateAvailable && React.createElement('button', {
              className: 'alg-btn-updater',
              onClick: onTriggerUpdate,
              disabled: updateState.updating,
            }, updateState.updating ? tt('updating') : tt('updateNow'))
          ),
          updateState.notice && React.createElement('div', {
            style: { padding: '8px 12px', marginBottom: 12, background: 'color-mix(in srgb, var(--dsw-alias-status-success) 10%, transparent)', color: 'var(--dsw-alias-status-success)', borderRadius: 6, fontSize: 12, border: '1px solid color-mix(in srgb, var(--dsw-alias-status-success) 20%, transparent)' }
          }, updateState.notice),

          // Section: Protection Telemetry
          React.createElement('div', {
            style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 2%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
          },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, tt('telemetryTitle')),
              telemetry.totalViolations > 0 && React.createElement('button', {
                className: 'alg-btn-ghost',
                onClick: onResetTelemetry,
              }, tt('resetStats'))
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              telemetry.error
                ? React.createElement('span', { style: { color: 'var(--dsw-alias-status-danger)' } }, telemetry.error)
                : telemetry.totalViolations > 0
                  ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                      React.createElement('div', null, tt('totalBlocked') + ': ', React.createElement('strong', { style: { color: 'var(--dsw-alias-status-warning)' } }, telemetry.totalViolations)),
                      telemetry.lastViolation && React.createElement('div', { style: { color: 'var(--dsw-alias-label-tertiary)' } },
                        tt('lastViolation') + ': ' + telemetry.lastViolation.code + ' (' + telemetry.lastViolation.tool + ')'
                      )
                    )
                  : React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, tt('noViolations'))
            )
          ),

          // Form fields
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

          // Save button and status
          React.createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: 10 }
          },
            React.createElement('button', {
              className: 'alg-btn-primary',
              onClick: onSave,
              disabled: saving || status !== 'ready',
            }, saving ? tt('saving') : tt('ready')),
            msg && React.createElement('span', { style: { fontSize: 13, color: msg === tt('saved') || msg === tt('statsResetDone') ? 'var(--dsw-alias-status-success)' : 'var(--dsw-alias-status-danger)' } }, msg)
          )
        );

      // The Plugins page renders this entry bare: it draws the title, the icon
      // and the crumb itself, so the row seat must not add a second card frame.
      if (bare) {
        return React.createElement('div', { className: 'alg-page' }, body);
      }
      return React.createElement('li', { className: 'alg-card' }, header, expanded && body);
    }

    // Row seat component: summary one-liner plus the bare form on the page.
    function PluginItem(props) {
      if (props && props.view === 'summary') {
        return React.createElement('div', {
          style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }
        }, en.sub);
      }
      return React.createElement(PluginCard, { ...props, bare: true });
    }

    exports.inject = ['slots', 'settingsScope', 'locale'];
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

      // Row seat first: the current core renders the Plugins page and opens
      // this entry from the row's configure control. The older seats stay as
      // fallbacks for hosts that only declare them.
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

      // List seat (plugins.item): the seat the Plugins page really renders as the
      // plugin's own page with its configuration — the page draws the title, icon
      // and crumb and asks for view 'summary' (the card's one-liner) or view 'page'
      // (the form), both served by PluginItem. The label is a static string on
      // purpose: it is resolved while the page renders, and a locale lookup there
      // would take the whole client batch down with it.
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
          (props) => React.createElement(PluginItem, { ...props, ctx: (props && props.ctx) || ctx })
        )
      );

      registerSlotWhenReady('settings.plugin.item', () =>
        ctx.slots.register(
          {
            name: 'settings.plugin.item',
            key: NS,
            order: 95,
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
