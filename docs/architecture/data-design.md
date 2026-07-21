# 数据设计

> 对应 schema：`WorkspaceState.schemaVersion = 2`

## 1. 工作区根对象

```json
{
  "schemaVersion": 2,
  "profile": {},
  "projects": [],
  "knowledge": [],
  "jobs": [],
  "applications": [],
  "resumeVariants": [],
  "syncedJobs": [],
  "jobSources": [],
  "jobFilterPresets": [],
  "jobAlertRules": [],
  "jobSyncRuns": [],
  "careerSearchPlans": [],
  "careerAgentRuns": [],
  "careerMemory": [],
  "companyWatches": [],
  "trainingSessions": [],
  "obsidianSyncIndex": [],
  "obsidianSyncConflicts": [],
  "obsidianSyncRuns": [],
  "settings": {},
  "updatedAt": "ISO-8601"
}
```

## 2. 实体分组

| 分组 | 权威实体 |
| --- | --- |
| 职业资产 | `CareerProfile`、`ProjectExperience`、`KnowledgeItem` |
| 岗位资产 | `SyncedJob`、`JobDescription`、`JobSourceConfig`、`JobFilterPreset` |
| 求职执行 | `CareerSearchPlan`、`CareerAgentRun`、`CareerMemoryItem` |
| 机会管理 | `CompanyWatch`、`JobApplication`、`ResumeVariant` |
| 面试训练 | `TrainingSession`、`TrainingAttempt`、压力训练总结 |
| 集成状态 | Provider 设置、Obsidian 设置、同步索引、冲突和运行记录 |

所有业务实体使用 UUID `id`、`createdAt` 和 `updatedAt`。外部岗位额外使用 `externalId`、`sourceUrl` 和确定性 `fingerprint`。

## 3. 关键关联

- `SyncedJob.linkedJobId` 指向转换后的 `JobDescription`。
- `JobApplication.jobId`、`ResumeVariant.jobId` 和 `TrainingSession.jobId` 关联目标 JD。
- 简历版本通过 `projectIds` 和 `skillIds` 引用真实证据。
- Agent 运行记录保存计划 ID 和命中岗位 ID。
- 公司关注通过规范化公司名称与职位池建立统计关系。
- Obsidian 同步索引通过 `entityId` 与 `interview_os_id` 维持稳定身份。

## 4. 岗位标准化字段

- 标题、公司、地点、薪资、JD、发布时间和来源。
- 行业、用工类型、学历、经验、技能、远程标记和薪资 K 值。
- 方向、技能、经验、学历、地点、薪资、时效七维匹配。
- 推荐理由、可信度、质量、风险、偏见和生命周期状态。
- 首次抓取、最后出现、出现次数和下游 JD 关联。

## 5. 文件布局

```text
InterviewOS/
├── database/
│   ├── state.json
│   ├── state.previous.json
│   └── state.tmp
├── exports/
├── backups/
├── attachments/
├── secure/
│   └── secrets.bin
└── logs/
```

Obsidian Vault 位于用户选择的外部目录，不属于工作区内部数据库。Interview OS 只写入配置的业务子目录，不访问 `.obsidian`。

## 6. 原子性与迁移

- 状态保存使用临时文件和同目录原子替换。
- 启动时验证 schema；旧版本自动补默认数组和设置。
- 无法解析的新数据不会静默丢弃，服务层返回稳定错误。
- Vault Markdown 更新前比较同步索引哈希；检测到外部修改时记录冲突并停止覆盖。

## 7. 敏感数据

以下内容不进入 `state.json`、Markdown 导出或普通日志：

- API Key、OAuth Token、Cookie 和账号密码；
- 招聘网站浏览器 Profile；
- 用户未授权持久化的完整模型请求；
- Obsidian `.obsidian` 内部配置。

Provider 普通配置只保存名称、Base URL、模型、启用状态和安全存储引用。

## 8. 备份与导出

- 备份包含版本、时间、SHA-256 清单、状态数据和可读 Markdown，不包含明文密钥。
- Markdown 导出覆盖职业资产、JD、岗位、投递、简历和训练记录。
- Obsidian Phase 1 使用独立同步索引，不替代工作区备份。
