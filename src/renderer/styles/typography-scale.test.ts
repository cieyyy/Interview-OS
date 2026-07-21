import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(process.cwd(), 'src/renderer/styles/global.css'), 'utf8');
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
    expect(css).toContain('--font-xs: 11px;');
    expect(css).toContain('--font-sm: 12px;');
    expect(css).toContain('--font-body: 13px;');
    expect(css).toContain('--font-md: 15px;');
    expect(css).toContain('--font-lg: 17px;');
    expect(css).toContain('--font-xl: 22px;');
    expect(css).toContain('--font-page: 28px;');
  });

  it('does not bypass the shared scale with hard-coded font sizes', () => {
    const rendererStyles = readRendererStyles(rendererRoot);
    expect(rendererStyles.match(/font-size\s*:\s*\d+(?:\.\d+)?px/g) ?? []).toEqual([]);
    expect(rendererStyles.match(/font\s*:\s*[^;]*\d+(?:\.\d+)?px/g) ?? []).toEqual([]);
    expect(rendererStyles.match(/fontSize\s*:\s*['"]\d+(?:\.\d+)?px['"]/g) ?? []).toEqual([]);
  });
});
