window.__ModuleLoader__.load({
  id: '@goodandready/dsh-agent-loop-guard',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    const React = require('react');
    const NS = '@goodandready/dsh-agent-loop-guard';

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
      totalBlocked: 'Loops Prevented',
      lastViolation: 'Last Incident',
      noViolations: 'No loop violations detected in current runtime.',
      resetStats: 'Reset Stats',
      statsResetDone: 'Stats reset',
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
      totalBlocked: '已拦截死循环',
      lastViolation: '最近拦截事件',
      noViolations: '当前运行时未检测到死循环违规。',
      resetStats: '重置统计',
      statsResetDone: '统计已重置',
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

    function PluginCard({ ctx: _ctx, t }) {
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
        currentVersion: '0.2.5',
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

      const currentLang = (_ctx?.locale?.get?.() || navigator.language || 'en').startsWith('zh') ? 'zh' : 'en';
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
              currentVersion: data.currentVersion || '0.2.5',
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
            if (!res.ok) return;
            const data = await res.json();
            if (cancelled) return;
            setTelemetry(data);
          } catch {}
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
          await fetch('/api/@goodandready/dsh-agent-loop-guard/telemetry', { method: 'POST' });
          setTelemetry({ totalViolations: 0, byCode: {}, lastViolation: null });
          setMsg(tt('statsResetDone'));
        } catch {}
      }

      const field = (key, input) => React.createElement('div', {
        className: 'alg-field',
        style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }
      },
        React.createElement('label', { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } }, tt(key)),
        input
      );

      const num = (key) => React.createElement('input', {
        type: 'number', value: draft[key],
        onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
        style: { height: 34, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '0 12px', fontSize: 13 }
      });

      const str = (key) => React.createElement('input', {
        type: 'text', value: draft[key],
        onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
        style: { height: 34, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '0 12px', fontSize: 13 }
      });

      const check = (key) => React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', padding: '6px 0' } },
        React.createElement('input', {
          type: 'checkbox', checked: !!draft[key],
          onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))
        }),
        tt(key)
      );

      return React.createElement('li', {
        className: 'alg-card',
        style: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', borderRadius: 12, listStyle: 'none', marginBottom: 12 }
      },
        React.createElement('button', {
          onClick: () => setExpanded(!expanded),
          'aria-expanded': expanded,
          style: { appearance: 'none', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', background: '0 0', border: 0, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }
        },
          React.createElement('span', { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 } },
              '🛑 ' + tt('title'),
              React.createElement('span', { style: { fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: 'var(--dsw-alias-accent-primary, #3b82f6)' } }, 'v' + updateState.currentVersion)
            ),
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, tt('sub'))
          ),
          React.createElement('span', { style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-tertiary)' } }, expanded ? '▲' : '▼')
        ),
        expanded && React.createElement('div', {
          className: 'alg-body',
          style: { padding: '0 16px 16px', borderTop: '1px solid var(--dsw-alias-border-l2)' }
        },
          // Section: One-Click Updater
          React.createElement('div', {
            style: { padding: '12px 14px', margin: '14px 0', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }
          },
            React.createElement('div', { style: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, tt('version') + ': ' + updateState.currentVersion),
              updateState.checking && React.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, tt('updateChecking')),
              !updateState.checking && updateState.updateAvailable && React.createElement('span', { style: { color: '#f59e0b', fontWeight: 600, fontSize: 12 } }, tt('updateAvailable', { v: updateState.latestVersion })),
              !updateState.checking && !updateState.updateAvailable && !updateState.error && React.createElement('span', { style: { color: '#10b981', fontSize: 12 } }, '✓ ' + tt('upToDate')),
              updateState.error && React.createElement('span', { style: { color: '#ef4444', fontSize: 12 } }, updateState.error)
            ),
            updateState.updateAvailable && React.createElement('button', {
              onClick: onTriggerUpdate,
              disabled: updateState.updating,
              style: { padding: '6px 14px', borderRadius: 6, background: 'var(--dsw-alias-accent-primary, #3b82f6)', color: '#fff', border: 0, fontSize: 12, fontWeight: 600, cursor: updateState.updating ? 'default' : 'pointer' }
            }, updateState.updating ? tt('updating') : tt('updateNow'))
          ),
          updateState.notice && React.createElement('div', {
            style: { padding: '8px 12px', marginBottom: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 6, fontSize: 12, border: '1px solid rgba(16,185,129,0.2)' }
          }, updateState.notice),

          // Section: Protection Telemetry
          React.createElement('div', {
            style: { padding: '12px 14px', margin: '14px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
          },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '📊 ' + tt('telemetryTitle')),
              telemetry.totalViolations > 0 && React.createElement('button', {
                onClick: onResetTelemetry,
                style: { background: 'transparent', border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-tertiary)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }
              }, tt('resetStats'))
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              telemetry.totalViolations > 0
                ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                    React.createElement('div', null, tt('totalBlocked') + ': ', React.createElement('strong', { style: { color: '#f59e0b' } }, telemetry.totalViolations)),
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
              onClick: onSave,
              disabled: saving || status !== 'ready',
              style: { height: 34, padding: '0 18px', border: 0, borderRadius: 8, background: 'var(--dsw-alias-accent-primary, #3b82f6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }
            }, saving ? tt('saving') : tt('ready')),
            msg && React.createElement('span', { style: { fontSize: 13, color: msg === tt('saved') || msg === tt('statsResetDone') ? '#10b981' : '#f87171' } }, msg)
          )
        )
      );
    }

    exports.inject = ['slots', 'settingsScope', 'locale'];
    exports.apply = function apply(ctx) {
      if (typeof ctx.locale?.register === 'function') {
        try { ctx.locale.register(NS, { en, zh }); } catch {}
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
