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
