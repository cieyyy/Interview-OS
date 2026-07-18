import { describe, expect, it } from 'vitest';
import { mapImportedDocument } from './document-import';

describe('mapImportedDocument', () => {
  it('maps a JD document into editable job fields', () => {
    const result = mapImportedDocument(
      'job',
      '云原生运维.txt',
      '岗位名称：云原生技术支持\n公司名称：示例科技\n任职要求：熟悉 Kubernetes、Docker 和 Linux。',
      'local'
    );
    expect(result.job).toMatchObject({ title: '云原生技术支持', company: '示例科技' });
    expect(result.job?.rawText).toContain('Kubernetes');
  });

  it('maps a resume into profile fields without inventing values', () => {
    const result = mapImportedDocument(
      'profile',
      'resume.md',
      '姓名：小柯\n当前岗位：运维工程师\n工作年限：2年\n学历：本科\n目标岗位：AI技术支持，云计算技术支持\n技能：Kubernetes:熟悉，Docker:掌握',
      'local'
    );
    expect(result.profile?.nickname).toBe('小柯');
    expect(result.profile?.yearsExperience).toBe(2);
    expect(result.profile?.targetRoles).toEqual(['AI技术支持', '云计算技术支持']);
    expect(result.profile?.skills).toEqual([
      { name: 'Kubernetes', level: '熟悉' },
      { name: 'Docker', level: '掌握' }
    ]);
  });

  it('turns a technical document into a knowledge draft', () => {
    const result = mapImportedDocument(
      'knowledge',
      'pod-failure.md',
      '# Pod 启动失败排查\n使用 kubectl describe pod 和 logs 排查 Kubernetes 故障。',
      'local'
    );
    expect(result.knowledge?.title).toBe('Pod 启动失败排查');
    expect(result.knowledge?.type).toBe('incident');
    expect(result.knowledge?.tags).toContain('Kubernetes');
  });
});
