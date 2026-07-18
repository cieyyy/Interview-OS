import { describe, expect, it } from 'vitest';
import { ValidationError, safeFileName, validateHttpUrl, validateKnowledgeInput } from './validation';

describe('validation', () => {
  it('cleans and validates knowledge input', () => {
    const value = validateKnowledgeInput({
      type: 'technical',
      title: '  Pod 排查  ',
      contentMarkdown: '  先看状态，再看 Events。 ',
      tags: ['K8s', 'K8s', ' 排障 ']
    });
    expect(value.title).toBe('Pod 排查');
    expect(value.tags).toEqual(['K8s', '排障']);
  });

  it('rejects unsupported URL protocols', () => {
    expect(() => validateHttpUrl('file:///etc/passwd')).toThrow(ValidationError);
  });

  it('produces traversal-safe file names', () => {
    expect(safeFileName('../模型/排查:*?')).not.toMatch(/[\\/:*?<>|]/);
    expect(safeFileName('../模型/排查:*?')).not.toContain('..');
  });
});

