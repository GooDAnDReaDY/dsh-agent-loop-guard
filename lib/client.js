window.__ModuleLoader__.load({
  id: '@goodandready/dsh-agent-loop-guard',
  factory: (require) => {
    var module = { exports: {} };
    const React = require('react');
    const NS = '@goodandready/dsh-agent-loop-guard';

    const en = {
      title: 'Agent Loop Guard',
      sub: 'Fail-closed tool-call and assistant-output loop limits',
      maxToolAttemptsPerTurn: 'Max tool attempts per turn',
      maxProgressToolCallsPerTurn: 'Max progress tool calls per turn',
      maxCallsPerRepeatGroup: 'Max calls per repeat group',
      blockExactDuplicates: 'Block exact duplicate tool calls',
      assistantOutputGuard: 'Assistant output guard',
      maxRepeatedAssistantLines: 'Max repeated assistant lines',
      maxRepeatedAssistantBlocks: 'Max repeated assistant blocks',
      maxAssistantBlockChars: 'Max assistant block chars',
      progressToolNames: 'Progress tool names (comma-separated)',
      saving: 'Saving…',
      ready: 'Save',
      saved: 'Saved',
    };
    const ru = {
      title: 'Agent Loop Guard',
      sub: 'Жёсткие лимиты на петли tool-call и повторы ответа ассистента',
      maxToolAttemptsPerTurn: 'Макс. попыток tool за ход',
      maxProgressToolCallsPerTurn: 'Макс. progress-tool за ход',
      maxCallsPerRepeatGroup: 'Макс. вызовов в repeat-группе',
      blockExactDuplicates: 'Блокировать точные дубликаты tool-call',
      assistantOutputGuard: 'Охрана повторов ответа ассистента',
      maxRepeatedAssistantLines: 'Макс. повторов строк',
      maxRepeatedAssistantBlocks: 'Макс. повторов блоков',
      maxAssistantBlockChars: 'Макс. символов блока',
      progressToolNames: 'Progress-инструменты (через запятую)',
      saving: 'Сохранение…',
      ready: 'Сохранить',
      saved: 'Сохранено',
    };

    const DEFAULTS = {
      maxToolAttemptsPerTurn: 64,
      maxProgressToolCallsPerTurn: 16,
      progressToolNames: ['todo_write'],
      maxCallsPerRepeatGroup: 5,
      blockExactDuplicates: true,
      assistantOutputGuard: true,
      maxRepeatedAssistantLines: 5,
      maxRepeatedAssistantBlocks: 5,
      maxAssistantBlockChars: 16384,
    };

    function PluginCard({ ctx: _ctx, t }) {
      const [expanded, setExpanded] = React.useState(false);
      const [draft, setDraft] = React.useState({ ...DEFAULTS, progressToolNamesText: 'todo_write' });
      const [status, setStatus] = React.useState('loading');
      const [saving, setSaving] = React.useState(false);
      const [msg, setMsg] = React.useState('');
      const scopeRef = React.useRef(null);
      if (!scopeRef.current && _ctx && _ctx.settingsScope) {
        try { scopeRef.current = _ctx.settingsScope.bind({ namespace: NS }); } catch (e) { scopeRef.current = null; }
      }
      const scope = scopeRef.current;
      const tt = t || ((k) => en[k] || k);

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
              setDraft((d) => ({ ...d, ...DEFAULTS, ...vals, progressToolNamesText: names.join(', ') }));
            }
            setStatus('ready');
          } catch (e) {
            if (!cancelled) setStatus('unavailable');
          }
        })();
        return () => { cancelled = true; };
      }, [scope]);

      async function onSave() {
        if (!scope) { setMsg('Settings unavailable'); return; }
        setSaving(true); setMsg('');
        const names = String(draft.progressToolNamesText || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const payload = {
          maxToolAttemptsPerTurn: Number(draft.maxToolAttemptsPerTurn) || 64,
          maxProgressToolCallsPerTurn: Number(draft.maxProgressToolCallsPerTurn) || 16,
          maxCallsPerRepeatGroup: Number(draft.maxCallsPerRepeatGroup) || 5,
          blockExactDuplicates: !!draft.blockExactDuplicates,
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
      const check = (key) => React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 } },
        React.createElement('input', {
          type: 'checkbox', checked: !!draft[key],
          onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))
        }),
        tt(key)
      );

      return React.createElement('li', {
        className: 'alg-card',
        style: { border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', borderRadius: 12, listStyle: 'none' }
      },
        React.createElement('button', {
          onClick: () => setExpanded(!expanded),
          'aria-expanded': expanded,
          style: { appearance: 'none', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', background: '0 0', border: 0, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }
        },
          React.createElement('span', { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-primary)', fontSize: 15, fontWeight: 600 } }, tt('title')),
            React.createElement('span', { style: { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, tt('sub'))
          ),
          React.createElement('span', { style: { marginLeft: 'auto', color: 'var(--dsw-alias-label-tertiary)' } }, expanded ? '▲' : '▼')
        ),
        expanded ? React.createElement('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', margin: '0 16px', paddingBottom: 8 } },
          status === 'loading' ? React.createElement('div', { style: { padding: 12 } }, 'Loading…') :
          status === 'unavailable' ? React.createElement('div', { style: { padding: 12 } }, 'Settings unavailable') :
          React.createElement(React.Fragment, null,
            field('maxToolAttemptsPerTurn', num('maxToolAttemptsPerTurn')),
            field('maxProgressToolCallsPerTurn', num('maxProgressToolCallsPerTurn')),
            field('maxCallsPerRepeatGroup', num('maxCallsPerRepeatGroup')),
            field('progressToolNames', React.createElement('input', {
              type: 'text', value: draft.progressToolNamesText || '',
              onChange: (e) => setDraft((d) => ({ ...d, progressToolNamesText: e.target.value })),
              style: { height: 34, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '0 12px', fontSize: 13 }
            })),
            React.createElement('div', { style: { padding: '8px 0' } }, check('blockExactDuplicates')),
            React.createElement('div', { style: { padding: '8px 0' } }, check('assistantOutputGuard')),
            field('maxRepeatedAssistantLines', num('maxRepeatedAssistantLines')),
            field('maxRepeatedAssistantBlocks', num('maxRepeatedAssistantBlocks')),
            field('maxAssistantBlockChars', num('maxAssistantBlockChars')),
            msg ? React.createElement('div', { style: { fontSize: 12, color: msg === tt('saved') ? 'var(--dsw-alias-label-secondary)' : '#d73a4a', padding: '4px 0' } }, msg) : null,
            React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '12px 0 4px', borderTop: '1px solid var(--dsw-alias-border-l2)' } },
              React.createElement('button', {
                onClick: onSave, disabled: saving,
                style: { appearance: 'none', font: 'inherit', cursor: 'pointer', border: '1px solid transparent', borderRadius: 8, padding: '5px 14px', fontSize: 13, background: 'var(--dsw-alias-label-primary)', color: 'var(--dsw-alias-bg-layer-3)', opacity: saving ? 0.6 : 1 }
              }, saving ? tt('saving') : tt('ready'))
            )
          )
        ) : null
      );
    }

    module.exports.inject = ['slots', 'locale'];
    module.exports.apply = function apply(ctx) {
      try { ctx.locale.register(NS, { en, ru }); } catch (e) {}
      if (!ctx.slots) return;
      const register = () => {
        try {
          return ctx.slots.register({
            name: 'settings.plugin.item',
            key: NS,
            locale: NS,
            inject: () => ({ ctx }),
          }, PluginCard);
        } catch (e) {
          console.warn('[dsh-agent-loop-guard] settings.plugin.item register failed', e && e.message || e);
        }
      };
      if (typeof ctx.slots.inject === 'function') {
        try { ctx.slots.inject('settings.plugin.item', register); }
        catch (e) { try { register(); } catch (e2) {} }
      } else {
        register();
      }
    };
    return module.exports;
  },
});
