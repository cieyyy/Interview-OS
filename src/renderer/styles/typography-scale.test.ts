import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'src/renderer/styles/global.css'), 'utf8');
const typography = readFileSync(path.resolve(process.cwd(), 'src/design-system/typography.css'), 'utf8');
const spacing = readFileSync(path.resolve(process.cwd(), 'src/design-system/spacing.css'), 'utf8');
const rendererRoot = path.resolve(process.cwd(), 'src/renderer');

function readRendererStyles(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return readRendererStyles(target);
      if (!entry.name.endsWith('.css') && !entry.name.endsWith('.vue')) return [];
      return [readFileSync(target, 'utf8')];
    })
    .join('\n');
}

describe('global typography scale', () => {
  it('defines the shared application font levels', () => {
    expect(typography).toContain('--text-page-title: 24px;');
    expect(typography).toContain('--text-module-title: 18px;');
    expect(typography).toContain('--text-card-title: 16px;');
    expect(typography).toContain('--text-body: 14px;');
    expect(typography).toContain('--text-supporting: 12px;');
    expect(typography).toContain('"Microsoft YaHei UI"');
    expect(typography).toContain('"PingFang SC"');
    expect(typography).toContain('"Inter"');
    expect(typography).toContain('"JetBrains Mono"');
    expect(css).toContain('--font-xs: var(--text-supporting);');
    expect(css).toContain('--font-sm: var(--text-supporting);');
    expect(css).toContain('--font-body: var(--text-body);');
    expect(css).toContain('--font-md: var(--text-card-title);');
    expect(css).toContain('--font-lg: var(--text-module-title);');
    expect(css).toContain('--font-page: var(--text-page-title);');
  });

  it('uses the required 4px spacing system', () => {
    for (const value of [4, 8, 12, 16, 20, 24, 32, 40, 48]) {
      expect(spacing).toContain(`${value}px;`);
    }
    expect(spacing).toContain('--page-padding-inline: 24px;');
    expect(spacing).toContain('--card-padding: 20px;');
    expect(spacing).toContain('--section-gap: 24px;');
  });

  it('does not bypass the shared scale with hard-coded font sizes', () => {
    const rendererStyles = readRendererStyles(rendererRoot);
    expect(rendererStyles.match(/font-size\s*:\s*\d+(?:\.\d+)?px/g) ?? []).toEqual([]);
    expect(rendererStyles.match(/font\s*:\s*[^;]*\d+(?:\.\d+)?px/g) ?? []).toEqual([]);
    expect(rendererStyles.match(/fontSize\s*:\s*['"]\d+(?:\.\d+)?px['"]/g) ?? []).toEqual([]);
  });
});
