import { describe, expect, it } from 'vitest';
import { analyzeSyncedJob, buildGreetingDraft, jobMatchesPreset, parseSalaryRange } from './job-intelligence';
import { createDefaultJobFilterPresets, createDemoState } from './domain';
import type { JobFilterPreset } from './domain';

describe('job intelligence', () => {
  it('normalizes salary ranges into monthly K values', () => {
    expect(parseSalaryRange('20K-30K·13薪')).toEqual({ min: 20, max: 30 });
    expect(parseSalaryRange('24-36万/年')).toEqual({ min: 20, max: 30 });
    expect(parseSalaryRange('200-300元/天')).toEqual({ min: 4.4, max: 6.5 });
  });

  it('extracts multi-industry fields, profile match and trust risks deterministically', () => {
    const profile = createDemoState().profile;
    const result = analyzeSyncedJob({
      sourceUrl: 'https://example.com/jobs/1', title: 'Kubernetes 运维工程师', company: '示例科技',
      location: '杭州', salaryRange: '20K-30K', postedAt: new Date().toISOString(),
      description: '负责 Kubernetes、Docker、Nginx 平台运维与生产故障排查，要求本科和 2-4 年经验，需要参与发布验证、监控建设、复盘改进和跨团队技术沟通。'
    }, profile);

    expect(result.industry).toBe('operations');
    expect(result.skills).toEqual(expect.arrayContaining(['Kubernetes', 'Docker', 'Nginx']));
    expect(result.education).toBe('本科');
    expect(result.experience).toBe('2-4年');
    expect(result.matchScore).toBeGreaterThan(50);
    expect(result.trustScore).toBeGreaterThanOrEqual(90);
  });

  it('treats missing work address as incomplete detail data instead of a risk flag', () => {
    const profile = createDemoState().profile;
    const result = analyzeSyncedJob({
      sourceUrl: 'https://example.com/jobs/2',
      title: '驻场运维工程师',
      company: '示例科技',
      location: '',
      salaryRange: '6K-10K',
      postedAt: new Date().toISOString(),
      description: '负责 Linux 服务器运维、Docker 环境部署、网络故障排查、监控告警处理和现场交付支持，需要熟悉 Shell 和常见中间件。'
    }, profile);

    expect(result.riskFlags).not.toContain('工作地点缺失');
    expect(result.qualityScore).toBeLessThan(100);
    expect(result.matchDimensions.location).toBeLessThan(70);
  });

  it('applies saved filter specifications and drafts evidence-bound greetings', () => {
    const profile = createDemoState().profile;
    const job = {
      title: '云原生运维工程师', company: '示例科技', description: 'Kubernetes Docker', location: '杭州',
      sourceSite: 'boss', industry: 'operations' as const, salaryMinK: 20, matchScore: 85, trustScore: 92,
      remote: false, capturedAt: new Date().toISOString()
    };
    const preset: JobFilterPreset = {
      id: 'preset', name: '云原生', includeKeywords: ['云原生'], excludeKeywords: ['外包'], cities: ['杭州'],
      industries: ['operations'], sources: ['boss'], minSalaryK: 15, minMatchScore: 70, minTrustScore: 80,
      remoteOnly: false, freshWithinDays: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    expect(jobMatchesPreset(job, preset)).toBe(true);
    const greeting = buildGreetingDraft(profile, job, {
      name: '示例科技-云原生定向版', highlights: ['负责 Kubernetes 集群发布与故障排查'], skillNames: ['Kubernetes', 'Docker']
    });
    expect(greeting).toContain('云原生运维工程师');
    expect(greeting).toContain('Kubernetes');
    expect(greeting).toContain('负责 Kubernetes 集群发布与故障排查');
    expect(greeting).not.toContain('示例科技-云原生定向版');
    expect(greeting).not.toContain('定向简历');
    expect(greeting).not.toContain('量身');
    expect(greeting).not.toContain('为该岗位准备');
    expect(greeting).not.toContain('我会基于');
  });

  it('applies filter presets across keywords, city, trust, remote and freshness', () => {
    const baseJob = {
      title: '云原生运维工程师',
      company: '示例科技',
      description: '负责 Kubernetes Docker 平台运维',
      location: '杭州',
      sourceSite: 'zhaopin',
      industry: 'operations' as const,
      salaryMinK: 20,
      matchScore: 82,
      trustScore: 88,
      remote: false,
      capturedAt: new Date().toISOString()
    };
    const basePreset: JobFilterPreset = {
      id: 'preset',
      name: '高匹配',
      includeKeywords: ['Kubernetes'],
      excludeKeywords: ['外包'],
      cities: ['杭州'],
      industries: ['operations'],
      sources: ['zhaopin'],
      minSalaryK: 15,
      minMatchScore: 70,
      minTrustScore: 80,
      remoteOnly: false,
      freshWithinDays: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(jobMatchesPreset(baseJob, basePreset)).toBe(true);
    expect(jobMatchesPreset({ ...baseJob, description: '负责 Docker 外包项目' }, basePreset)).toBe(false);
    expect(jobMatchesPreset({ ...baseJob, location: '成都' }, basePreset)).toBe(false);
    expect(jobMatchesPreset({ ...baseJob, trustScore: 60 }, basePreset)).toBe(false);
    expect(jobMatchesPreset(baseJob, { ...basePreset, remoteOnly: true })).toBe(false);
    expect(jobMatchesPreset({ ...baseJob, remote: true }, { ...basePreset, remoteOnly: true })).toBe(true);
    expect(jobMatchesPreset({ ...baseJob, capturedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() }, basePreset)).toBe(false);
  });

  it('filters multi-platform synced jobs by different saved rules', () => {
    const now = new Date().toISOString();
    const jobs = [
      {
        title: 'Kubernetes 运维工程师',
        company: '智联样本',
        description: '负责 Kubernetes Docker Linux 平台运维',
        location: '成都·武侯区',
        sourceSite: 'zhaopin',
        industry: 'operations' as const,
        salaryMinK: 7,
        matchScore: 72,
        trustScore: 85,
        remote: false,
        capturedAt: now
      },
      {
        title: 'SRE 远程工程师',
        company: '前程无忧样本',
        description: '负责 SRE Kubernetes Prometheus，可远程办公',
        location: '远程',
        sourceSite: '51job',
        industry: 'operations' as const,
        salaryMinK: 18,
        matchScore: 86,
        trustScore: 90,
        remote: true,
        capturedAt: now
      },
      {
        title: '运维外包工程师',
        company: '外包样本',
        description: '外包驻场，负责 Linux 运维',
        location: '成都',
        sourceSite: 'boss',
        industry: 'operations' as const,
        salaryMinK: 10,
        matchScore: 78,
        trustScore: 82,
        remote: false,
        capturedAt: now
      },
      {
        title: '销售顾问',
        company: '低相关样本',
        description: '客户销售与商务沟通',
        location: '成都',
        sourceSite: 'liepin',
        industry: 'sales' as const,
        salaryMinK: 8,
        matchScore: 30,
        trustScore: 88,
        remote: false,
        capturedAt: now
      }
    ];
    const zhaopinChengdu: JobFilterPreset = {
      id: 'zhaopin-chengdu',
      name: '智联成都运维',
      includeKeywords: ['Kubernetes'],
      excludeKeywords: ['外包'],
      cities: ['成都'],
      industries: ['operations'],
      sources: ['zhaopin'],
      minSalaryK: 0,
      minMatchScore: 60,
      minTrustScore: 70,
      remoteOnly: false,
      freshWithinDays: 30,
      createdAt: now,
      updatedAt: now
    };
    const remoteSre: JobFilterPreset = {
      ...zhaopinChengdu,
      id: 'remote-sre',
      name: '远程 SRE',
      includeKeywords: ['SRE'],
      cities: [],
      sources: ['51job'],
      minSalaryK: 15,
      minMatchScore: 80,
      minTrustScore: 80,
      remoteOnly: true
    };
    const noOutsourcing: JobFilterPreset = {
      ...zhaopinChengdu,
      id: 'no-outsourcing',
      name: '排除外包',
      includeKeywords: ['运维'],
      cities: [],
      sources: [],
      minMatchScore: 60
    };

    expect(jobs.filter((job) => jobMatchesPreset(job, zhaopinChengdu)).map((job) => job.title)).toEqual(['Kubernetes 运维工程师']);
    expect(jobs.filter((job) => jobMatchesPreset(job, remoteSre)).map((job) => job.title)).toEqual(['SRE 远程工程师']);
    expect(jobs.filter((job) => jobMatchesPreset(job, noOutsourcing)).map((job) => job.title)).toEqual(['Kubernetes 运维工程师']);
  });

  it('applies default industry presets to different job families and excludes risky postings', () => {
    const now = new Date().toISOString();
    const jobs = [
      {
        title: 'Kubernetes 平台工程师', company: '云厂商', description: '负责 Kubernetes Docker 云原生平台工程',
        location: '杭州', sourceSite: 'boss', industry: 'technology' as const, salaryMinK: 25, matchScore: 88, trustScore: 92, remote: false, capturedAt: now
      },
      {
        title: '产品经理 AI SaaS', company: '软件公司', description: '负责 AI SaaS B端 产品经理 数据分析',
        location: '上海', sourceSite: 'zhaopin', industry: 'product' as const, salaryMinK: 18, matchScore: 82, trustScore: 90, remote: false, capturedAt: now
      },
      {
        title: 'UI/UX 设计师', company: '设计团队', description: '负责 UI UX 交互设计 Figma 作品集',
        location: '深圳', sourceSite: '51job', industry: 'design' as const, salaryMinK: 12, matchScore: 76, trustScore: 82, remote: false, capturedAt: now
      },
      {
        title: '大客户销售经理', company: '企业服务', description: '负责大客户 销售 商务 解决方案',
        location: '北京', sourceSite: 'liepin', industry: 'sales' as const, salaryMinK: 15, matchScore: 72, trustScore: 86, remote: false, capturedAt: now
      },
      {
        title: '新媒体增长运营', company: '内容平台', description: '负责运营 增长 内容 新媒体 活动 数据分析',
        location: '杭州', sourceSite: 'lagou', industry: 'marketing' as const, salaryMinK: 10, matchScore: 70, trustScore: 78, remote: false, capturedAt: now
      },
      {
        title: 'HR 招聘专员', company: '集团总部', description: '负责人力资源 招聘 合规',
        location: '上海', sourceSite: 'company-careers', industry: 'human-resources' as const, salaryMinK: 9, matchScore: 68, trustScore: 84, remote: false, capturedAt: now
      },
      {
        title: '课程教研老师', company: '教育机构', description: '负责教育 教研 课程 助教',
        location: '成都', sourceSite: 'import', industry: 'education' as const, salaryMinK: 7, matchScore: 66, trustScore: 78, remote: false, capturedAt: now
      },
      {
        title: 'AI SaaS 外包产品经理', company: '外包公司', description: '外包 产品经理 AI SaaS',
        location: '上海', sourceSite: 'boss', industry: 'product' as const, salaryMinK: 20, matchScore: 88, trustScore: 90, remote: false, capturedAt: now
      }
    ];
    const presets = createDefaultJobFilterPresets(now);

    const matchedByPreset = Object.fromEntries(presets.map((preset) => [
      preset.id,
      jobs.filter((job) => jobMatchesPreset(job, preset)).map((job) => job.title)
    ]));

    expect(matchedByPreset['preset-tech-cloud-native']).toEqual(['Kubernetes 平台工程师']);
    expect(matchedByPreset['preset-product-ai-saas']).toEqual(['产品经理 AI SaaS']);
    expect(matchedByPreset['preset-design-ux']).toEqual(['UI/UX 设计师']);
    expect(matchedByPreset['preset-sales-enterprise']).toEqual(['大客户销售经理']);
    expect(matchedByPreset['preset-marketing-growth']).toEqual(['新媒体增长运营']);
    expect(matchedByPreset['preset-finance-hr-legal']).toEqual(['HR 招聘专员']);
    expect(matchedByPreset['preset-education-general']).toEqual(['课程教研老师']);
    expect(Object.values(matchedByPreset).flat()).not.toContain('AI SaaS 外包产品经理');
  });
});
