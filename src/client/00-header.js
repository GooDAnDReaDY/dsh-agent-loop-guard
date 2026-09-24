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
