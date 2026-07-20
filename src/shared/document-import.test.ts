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

  it('extracts multiple project experiences from a complete resume', () => {
    const result = mapImportedDocument(
      'profile',
      '完整简历.md',
      [
        '姓名：小柯',
        '当前岗位：运维工程师',
        '项目经历',
        '项目名称：AI 漫剧算力平台',
        '项目角色：平台运维',
        '项目背景：通过内部画布调用上游模型服务。',
        '个人职责：负责 ACK 发布、日志排查与 API 联调。',
        '技术栈：Kubernetes，ACK，ACR，Docker',
        '项目结果：定位模型映射问题并推动版本上线。',
        '项目名称：内部成本管理系统',
        '项目角色：运维工程师',
        '项目描述：公司内部成本与能力管理。',
        '主要工作：维护 GitHub Runner 自动发布流程。',
        '项目结果：完成稳定上线。',
        '专业技能',
        'Kubernetes、Docker'
      ].join('\n'),
      'local'
    );
    expect(result.projects).toHaveLength(2);
    expect(result.projects?.[0]).toMatchObject({
      name: 'AI 漫剧算力平台',
      role: '平台运维',
      results: '定位模型映射问题并推动版本上线。'
    });
    expect(result.projects?.[0].techStack).toEqual(expect.arrayContaining(['Kubernetes', 'ACK', 'ACR', 'Docker']));
    expect(result.projects?.[1].name).toBe('内部成本管理系统');
  });

  it('reconnects project names and details when a PDF extracts two-column content out of visual order', () => {
    const result = mapImportedDocument(
      'profile',
      '双栏测试简历.pdf',
      [
        '姓 \t名：测试用户 \t工 作 年 限：3年',
        '学 \t历：本科 \t专 \t业：网络工程',
        '意 向 岗 位：测试运维 \t到 岗 时 间：一周内',
        '项目描述：医院门诊排队叫号系统，包含终端、大屏和管理后台。',
        '我的职责：',
        '测试工作：负责叫号和异常场景测试。',
        '运维工作：使用 Docker 部署并检查日志。',
        '项目结果：系统稳定上线。',
        '项目描述：智慧病房呼叫系统，提供患者呼叫和护士站处理。',
        '我的职责：负责接口、数据库一致性验证和环境维护。',
        '工作成果：上线后未出现重大数据异常。',
        '基本信息',
        '求职意向',
        '工作经历',
        '项目经验',
        '医院排队叫号系统（2024.03-2025.11）',
        '智慧病房呼叫系统（2024.03-2025.11）',
        '教育经历'
      ].join('\n'),
      'local'
    );
    expect(result.profile?.nickname).toBe('测试用户');
    expect(result.profile?.yearsExperience).toBe(3);
    expect(result.profile?.education).toBe('本科');
    expect(result.profile?.targetRoles).toEqual(['测试运维']);
    expect(result.projects).toHaveLength(2);
    expect(result.projects?.[0]).toMatchObject({
      name: '医院排队叫号系统',
      background: expect.stringContaining('门诊排队叫号'),
      responsibilities: expect.stringContaining('异常场景测试'),
      results: '系统稳定上线。'
    });
    expect(result.projects?.[1]).toMatchObject({
      name: '智慧病房呼叫系统',
      results: '上线后未出现重大数据异常。'
    });
  });

  it('recognizes table fields separated by tabs in legacy Word resumes', () => {
    const result = mapImportedDocument(
      'profile',
      '旧版表格简历.doc',
      [
        '求职意向：移动端开发工程师',
        '工作经历',
        '开发工具\tEclipse、SVN',
        '项目描述\t健康资讯应用，向用户提供分类资讯。',
        '责任描述\t负责首页列表、分页加载和缓存优化。',
        '开发工具\tEclipse、SVN',
        '项目描述\t联系人管理应用，支持快捷拨号和黑名单。',
        '责任描述\t负责联系人列表和搜索模块开发。',
        '自我评价'
      ].join('\n'),
      'local'
    );

    expect(result.projects).toHaveLength(2);
    expect(result.projects?.[0]).toMatchObject({
      name: '简历项目 1（待命名）',
      background: '健康资讯应用，向用户提供分类资讯。',
      responsibilities: '负责首页列表、分页加载和缓存优化。'
    });
    expect(result.projects?.[0].techStack).toEqual(expect.arrayContaining(['Eclipse', 'SVN']));
  });

  it('keeps unnamed projects when a legacy document merges the section heading with a tool name', () => {
    const result = mapImportedDocument(
      'profile',
      '旧版移动端简历.doc',
      [
        '工作经历',
        '项目经验Eclipse',
        '每日资讯应用，提供新闻推送和专题图片。',
        '使用网络接口获取 JSON 数据并完成列表展示。',
        'Eclipse',
        '股票学习应用，提供入门知识和资讯。',
        '负责首页列表和下拉刷新。',
        'Eclipse',
        '菜谱应用，提供按食材查找菜谱的功能。',
        '负责分类页面和详情页面。',
        '自我评价'
      ].join('\n'),
      'local'
    );

    expect(result.projects).toHaveLength(3);
    expect(result.projects?.map((item) => item.name)).toEqual([
      '简历项目 1（待命名）',
      '简历项目 2（待命名）',
      '简历项目 3（待命名）'
    ]);
    expect(result.projects?.[2].background).toContain('菜谱应用');
  });

  it('splits English project entries that use month-based date ranges', () => {
    const result = mapImportedDocument(
      'profile',
      'english-resume.pdf',
      [
        'PROJECT EXPERIENCE',
        'Jan 2023 - Mar 2024 Customer Analytics Platform',
        'Description: Built reporting workflows for a retail team.',
        'Responsibilities: Validated data quality and release readiness.',
        'Apr 2022 - Dec 2022 Campus Scheduling System',
        'Description: Created a scheduling system for student services.',
        'Responsibilities: Implemented integration tests and deployment checks.',
        'EDUCATION'
      ].join('\n'),
      'local'
    );

    expect(result.projects).toHaveLength(2);
    expect(result.projects?.map((item) => item.name)).toEqual([
      'Customer Analytics Platform',
      'Campus Scheduling System'
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
