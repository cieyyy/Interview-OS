import type { KnowledgeInput, ProjectExperience } from './domain';

export function buildProjectKnowledgeInputs(project: ProjectExperience): KnowledgeInput[] {
  const shared = {
    status: 'learning' as const,
    source: '用户生成 · 项目资产库',
    relatedIds: [],
    jobIds: [],
    projectIds: [project.id],
    skillNames: project.techStack,
    visibility: 'private' as const
  };
  return [
    {
      ...shared,
      id: `project-knowledge-${project.id}-overview`,
      type: 'project',
      title: `${project.name}｜项目介绍`,
      tags: ['项目资产', ...project.techStack.slice(0, 5)],
      contentMarkdown: `# ${project.name}\n\n## 背景\n\n${project.background}\n\n## 目标\n\n${project.objective}\n\n## 架构\n\n${project.architecture}\n\n## 我的职责\n\n${project.responsibilities}\n\n## 行动\n\n${project.actions}\n\n## 结果\n\n${project.results}`
    },
    {
      ...shared,
      id: `project-knowledge-${project.id}-questions`,
      type: 'question',
      title: `${project.name}｜面试问题`,
      tags: ['项目深挖', '面试问题'],
      contentMarkdown: `# 项目深挖问题\n\n- 这个项目解决了什么问题？\n- 你个人负责的边界是什么？\n- 为什么选择 ${project.techStack.slice(0, 3).join('、') || '当前技术方案'}？\n- 最大故障或风险是什么？\n- 如果重新设计，你会优化什么？`
    },
    {
      ...shared,
      id: `project-knowledge-${project.id}-incident`,
      type: 'incident',
      title: `${project.name}｜故障与风险`,
      tags: ['故障案例', '项目复盘'],
      contentMarkdown: `# 故障与风险\n\n## 已知挑战\n\n${project.challenges || '待补充真实故障、风险或技术难点。'}\n\n## 排查与行动\n\n${project.actions || '待补充本人执行的排查步骤。'}\n\n## 可验证结果\n\n${project.results || '待补充验证方式与结果。'}`
    },
    {
      ...shared,
      id: `project-knowledge-${project.id}-learning`,
      type: 'learning-plan',
      title: `${project.name}｜学习知识`,
      tags: ['学习计划', ...project.techStack.slice(0, 5)],
      contentMarkdown: `# 学习与复习\n\n${project.techStack.map((item) => `- [ ] ${item}：原理、使用场景、故障排查和项目证据`).join('\n') || '- [ ] 补充项目技术栈'}\n\n## 关联项目\n\n[[${project.name}｜项目介绍]]`
    }
  ];
}
