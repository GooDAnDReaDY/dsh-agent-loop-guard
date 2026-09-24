    const CSS_STYLES = `
.alg-page { width: 100%; min-width: 0; }
.alg-card {
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px; list-style: none; margin-bottom: 12px; overflow: hidden;
  transition: border-color 0.15s ease;
}
.alg-card:hover { border-color: var(--dsw-alias-border-l1, var(--dsw-alias-border-l2)); }
.alg-header-btn {
  appearance: none; width: 100%; font: inherit; color: inherit; text-align: left;
  cursor: pointer; background: transparent; border: 0; border-radius: 12px;
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  transition: background 0.15s ease;
}
.alg-header-btn:hover { background: var(--dsw-alias-bg-hover, var(--dsw-alias-bg-layer-hover)); }
.alg-chevron {
  margin-left: auto; color: var(--dsw-alias-label-tertiary);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s ease;
}
.alg-chevron.expanded { transform: rotate(180deg); }
.alg-body { padding: 0 16px 16px; border-top: 1px solid var(--dsw-alias-border-l2); }
.alg-field { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; }
.alg-field label { font-size: 13px; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.alg-input {
  height: 34px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);
  border-radius: 8px; padding: 0 12px; font-size: 13px; outline: none;
  transition: border-color 0.15s ease;
}
.alg-input:focus { border-color: var(--dsw-alias-accent-primary); }
.alg-checkbox-label {
  display: flex; align-items: center; gap: 8px; font-size: 13px;
  color: var(--dsw-alias-label-primary); cursor: pointer; padding: 6px 0;
}
.alg-btn-primary {
  appearance: none; font: inherit; cursor: pointer; border: 0; border-radius: 8px;
  padding: 6px 16px; font-size: 13px; font-weight: 500;
  background: var(--dsw-alias-accent-primary); color: var(--dsw-alias-bg-layer-3);
  transition: opacity 0.15s ease;
}
.alg-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.alg-btn-primary:disabled { opacity: 0.5; cursor: default; }
.alg-btn-updater {
  appearance: none; font: inherit; cursor: pointer; border: 0; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; font-weight: 500;
  background: var(--dsw-alias-accent-primary); color: var(--dsw-alias-bg-layer-3);
  transition: opacity 0.15s ease;
}
.alg-btn-updater:hover:not(:disabled) { opacity: 0.9; }
.alg-btn-updater:disabled { opacity: 0.6; cursor: default; }
.alg-btn-ghost {
  background: transparent; border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-tertiary); border-radius: 4px; padding: 2px 8px;
  font-size: 11px; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease;
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
