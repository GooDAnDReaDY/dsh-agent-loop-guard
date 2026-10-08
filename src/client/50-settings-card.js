    const DEFAULTS = {
      maxToolAttemptsPerTurn: 64, maxProgressToolCallsPerTurn: 16, progressToolNames: ['todo_write'],
      maxCallsPerRepeatGroup: 5, strictTools: [], strictToolLimit: 3, blockExactDuplicates: true,
      dryRunMode: false, assistantOutputGuard: true, maxRepeatedAssistantLines: 5,
      maxRepeatedAssistantBlocks: 5, maxAssistantBlockChars: 16384,
    };

    function PluginCard({ ctx: _ctx, t, bare }) {
      const [expanded, setExpanded] = React.useState(false);
      const isExpanded = Boolean(bare || expanded);
      const [draft, setDraft] = React.useState({ ...DEFAULTS, progressToolNamesText: 'todo_write', strictToolsText: '' });
      const [status, setStatus] = React.useState('loading');
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState('');

      const [updateState, setUpdateState] = React.useState({
        checking: false, updateAvailable: false, currentVersion: '', latestVersion: '',
        updating: false, notice: '', error: '',
      });

      const [telemetry, setTelemetry] = React.useState({ totalViolations: 0, byCode: {}, lastViolation: null });

      const scopeRef = React.useRef(null);
      if (!scopeRef.current && _ctx && _ctx.configForms) {
        try { scopeRef.current = _ctx.configForms.get(NS); } catch (e) { scopeRef.current = null; }
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
          if (!cancelled && typeof scope.getSnapshot === 'function') { try { syncFromSnapshot(scope.getSnapshot()); } catch (_) {} }
        }) : null;

        return () => {
          cancelled = true;
          if (typeof unsub === 'function') unsub();
        };
      }, [scope]);

      React.useEffect(() => {
        if (!isExpanded) return;
        let cancelled = false;

        (async () => {
          setUpdateState((s) => ({ ...s, checking: true, error: '', notice: '' }));
          try {
            const res = await fetch('/api/@goodandready/dsh-agent-loop-guard/update');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (cancelled) return;
            setUpdateState((s) => ({
              ...s, checking: false, currentVersion: data.currentVersion || '',
              latestVersion: data.latestVersion || '', updateAvailable: !!data.updateAvailable,
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
      }, [isExpanded]);

      async function onSave() {
        if (!scope) { setMsg('Settings unavailable'); return; }
        setSaving(true); setMsg('');
        const names = String(draft.progressToolNamesText || '').split(',').map((s) => s.trim()).filter(Boolean);
        const strictNames = String(draft.strictToolsText || '').split(',').map((s) => s.trim()).filter(Boolean);
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
          if (!res.ok || data.error) throw new Error(data.error || 'Update failed with HTTP ' + res.status);
          setUpdateState((s) => ({
            ...s, updating: false, updateAvailable: false,
            currentVersion: data.updatedVersion || s.latestVersion,
            notice: tt('updateSuccess', { v: data.updatedVersion || s.latestVersion }),
          }));
        } catch (err) {
          setUpdateState((s) => ({ ...s, updating: false, error: tt('updateFailed', { msg: err.message || String(err) }) }));
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
          width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
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
        type: 'number', className: 'alg-input', value: draft[key],
        onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
      });

      const str = (key) => React.createElement('input', {
        type: 'text', className: 'alg-input', value: draft[key],
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
                  background: updateState.updateAvailable ? 'color-mix(in srgb, var(--dsw-alias-accent-primary) 15%, transparent)' : 'color-mix(in srgb, var(--dsw-alias-status-success) 15%, transparent)',
                  color: updateState.updateAvailable ? 'var(--dsw-alias-accent-primary)' : 'var(--dsw-alias-status-success)',
                }
              }, updateState.checking ? tt('updateChecking') : (updateState.updateAvailable ? tt('updateAvailable', { v: updateState.latestVersion }) : (updateState.currentVersion ? tt('upToDate') : '—')))
            ),
            updateState.error && React.createElement('span', { style: { color: 'var(--dsw-alias-status-danger)', fontSize: 12 } }, updateState.error)
          ),
          updateState.updateAvailable && React.createElement('button', {
            className: 'alg-btn-updater', onClick: onTriggerUpdate, disabled: updateState.updating,
          }, updateState.updating ? tt('updating') : tt('updateNow'))
        ),
        updateState.notice && React.createElement('div', {
          style: { padding: '8px 12px', marginBottom: 12, background: 'color-mix(in srgb, var(--dsw-alias-status-success) 10%, transparent)', color: 'var(--dsw-alias-status-success)', borderRadius: 6, fontSize: 12, border: '1px solid color-mix(in srgb, var(--dsw-alias-status-success) 20%, transparent)' }
        }, updateState.notice),

        React.createElement('div', {
          style: { padding: '12px 14px', margin: '14px 0', background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 2%, transparent)', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)' }
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
            React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, tt('telemetryTitle')),
            telemetry.totalViolations > 0 && React.createElement('button', {
              className: 'alg-btn-ghost', onClick: onResetTelemetry,
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

        React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: 10 }
        },
          React.createElement('button', {
            className: 'alg-btn-primary', onClick: onSave, disabled: saving || status !== 'ready',
          }, saving ? tt('saving') : tt('ready')),
          msg && React.createElement('span', { style: { fontSize: 13, color: msg === tt('saved') || msg === tt('statsResetDone') ? 'var(--dsw-alias-status-success)' : 'var(--dsw-alias-status-danger)' } }, msg)
        )
      );

      if (bare) {
        return React.createElement('div', { className: 'alg-page' }, body);
      }
      return React.createElement('li', { className: 'alg-card' }, header, expanded && body);
    }

    function PluginItem(props) {
      if (props && props.view === 'summary') {
        return React.createElement('div', {
          style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }
        }, en.sub);
      }
      return React.createElement(PluginCard, { ...props, bare: true });
    }
