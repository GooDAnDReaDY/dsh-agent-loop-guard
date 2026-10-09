import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPath = path.resolve(__dirname, '../lib/client.js');
const require = createRequire(import.meta.url);

export const CANONICAL_THEME_TOKENS = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-mask-1',
  '--dsw-alias-bg-mask-2',
  '--dsw-alias-bg-mask-3',
  '--dsw-alias-bg-mask-drop',
  '--dsw-alias-bg-mask-photo',
  '--dsw-alias-bg-module-platform',
  '--dsw-alias-bg-multi-select',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-bg-skeleton',
  '--dsw-alias-border-inverted',
  '--dsw-alias-border-inverted2',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-border-l2-darkmode-thin',
  '--dsw-alias-border-l3',
  '--dsw-alias-border-l4',
  '--dsw-alias-brand-primary',
  '--dsw-alias-brand-primary-invert',
  '--dsw-alias-brand-primary-new-colorprimary-new-color',
  '--dsw-alias-brand-text',
  '--dsw-alias-button-contrast-fill',
  '--dsw-alias-button-elevated-fill',
  '--dsw-alias-button-floating-fill',
  '--dsw-alias-button-floating-hover',
  '--dsw-alias-button-ghost-active-border',
  '--dsw-alias-button-ghost-active-fill',
  '--dsw-alias-button-ghost-active-hover',
  '--dsw-alias-button-info-fill',
  '--dsw-alias-button-info-hover',
  '--dsw-alias-button-primary-dimmed',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-button-primary-hover',
  '--dsw-alias-button-tool-bar-fill',
  '--dsw-alias-button-tool-bar-fill-invisible',
  '--dsw-alias-button-tool-bar-hover',
  '--dsw-alias-interactive-bg-active',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-hover-accent',
  '--dsw-alias-interactive-bg-hover-danger',
  '--dsw-alias-interactive-bg-hover-solid',
  '--dsw-alias-label-caption',
  '--dsw-alias-label-dimmed',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-primary-bluish',
  '--dsw-alias-label-primary-dimmed',
  '--dsw-alias-label-primary-foreground',
  '--dsw-alias-label-primary-inverted',
  '--dsw-alias-label-secondary',
  '--dsw-alias-label-tertiary',
  '--dsw-alias-link',
  '--dsw-alias-markdown-citation',
  '--dsw-alias-markdown-code-block',
  '--dsw-alias-markdown-code-block-banner',
  '--dsw-alias-markdown-code-segment-selected',
  '--dsw-alias-markdown-code-segment-unselected',
  '--dsw-alias-markdown-inline-code',
  '--dsw-alias-markdown-placeholder',
  '--dsw-alias-markdown-tag',
  '--dsw-alias-scrollbar-bg-l1',
  '--dsw-alias-scrollbar-bg-l2',
  '--dsw-alias-scrollbar-hover-l1',
  '--dsw-alias-scrollbar-hover-l2',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-state-business-tertiary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-error-secondary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-success-secondary',
  '--dsw-alias-state-success-tertiary',
  '--dsw-alias-state-warn-label',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-warn-secondary',
  '--dsw-alias-state-warn-tertiary',
  '--dsw-alias-toast-bg',
  '--dsw-alias-tooltip-bg',
]);

export function loadInstalledThemeTokens() {
  const possiblePaths = [
    () => require.resolve('@deepseek-ai/dsh-client-ui-theme/lib/client.js'),
    () => '/home/vadim/.nvm/versions/node/v24.15.0/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
    () => '/home/vadim/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js',
  ];
  for (const resolveFn of possiblePaths) {
    try {
      const p = resolveFn();
      if (fs.existsSync(p)) {
        const themeContent = fs.readFileSync(p, 'utf8');
        const matches = themeContent.match(/--dsw-alias-[a-z0-9-]+/g);
        if (matches && matches.length > 0) {
          return new Set(matches);
        }
      }
    } catch {}
  }
  return CANONICAL_THEME_TOKENS;
}

export function validateClientTokens(content, canonicalTokens = loadInstalledThemeTokens()) {
  const matches = content.match(/--dsw-alias-[a-z0-9-]+/g) || [];
  const clientTokens = new Set(matches);
  const unknownTokens = [];
  for (const token of clientTokens) {
    if (!canonicalTokens.has(token)) {
      unknownTokens.push(token);
    }
  }
  return {
    valid: unknownTokens.length === 0,
    clientTokens: Array.from(clientTokens).sort(),
    unknownTokens: unknownTokens.sort(),
  };
}

test('theme guard: client.js contains zero hardcoded hex colors or rgba literals', () => {
  const content = fs.readFileSync(clientPath, 'utf8');
  const colorPattern = /#[\da-fA-F]{3,8}\b|rgba?\(/g;
  const matches = content.match(colorPattern);
  assert.equal(matches, null, `Found hardcoded color or rgba in lib/client.js: ${matches ? matches.join(', ') : ''}`);
  assert.doesNotMatch(content, /#[\da-f]{3,8}\b|rgba?\(/i, 'lib/client.js must not contain hardcoded hex or rgba');
});

test('theme guard: all --dsw-alias-* tokens in client.js belong to canonical DSH theme (#100, #104)', () => {
  const content = fs.readFileSync(clientPath, 'utf8');
  const canonical = loadInstalledThemeTokens();
  const result = validateClientTokens(content, canonical);
  assert.equal(
    result.unknownTokens.length,
    0,
    `Found non-existent theme tokens in lib/client.js: ${result.unknownTokens.join(', ')}`
  );
  assert.ok(result.clientTokens.length >= 10, 'client.js must use at least 10 canonical tokens');
});

test('theme guard: detects and lists non-existent theme tokens (#104)', () => {
  const fakeContent = `
    .my-button {
      background: var(--dsw-alias-fake-accent);
      color: var(--dsw-alias-invalid-status);
      border: 1px solid var(--dsw-alias-border-l2);
    }
  `;
  const result = validateClientTokens(fakeContent, CANONICAL_THEME_TOKENS);
  assert.equal(result.valid, false);
  assert.deepEqual(result.unknownTokens, [
    '--dsw-alias-fake-accent',
    '--dsw-alias-invalid-status',
  ]);
});