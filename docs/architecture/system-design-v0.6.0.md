# Interview OS v0.6.0 系统架构

## 架构原则

- 增量升级：保留 v0.5.0 路由、接口、数据和工作流。
- 本地优先：工作区数据默认只写入本机。
- 兼容迁移：schema 2 自动升级 schema 3，并在落盘前备份。
- 能力融合：UI 只有一个 AI 职业教练入口，底层保留旧训练会话供历史兼容。
- 真实证据：简历、项目、回答和知识联动不得编造经历。

## 分层

```text
Vue Renderer
  ├─ 12 个产品模块
  ├─ src/design-system
  └─ components/ui
        │ secure typed IPC
Electron Main
  ├─ WorkspaceService
  ├─ ProviderService
  ├─ JobSyncService
  ├─ DocumentImportService
  └─ ObsidianVaultService（兼容导出）
        │
AtomicWorkspaceRepository
  ├─ database/state.json
  ├─ database/state.previous.json
  ├─ backups/
  ├─ migrations/
  └─ exports/
```

## 核心模型

- `WorkspaceState.schemaVersion = 3`
- `CoachSession`：模式、岗位、简历、项目、消息、回答、报告。
- `KnowledgeItem`：类型、Markdown、标签、状态、可见性、岗位、项目、技能、复习时间。
- `WorkspaceMigrationRecord`：原版本、目标版本和迁移时间。

## 兼容策略

`TrainingSession` 不删除。每次开始、提交和完成训练时，同步更新对应 `CoachSession`；v0.5.0 历史训练在读取工作区时转换为统一会话。旧 `/training` 与 `/assistant` 路由重定向到 `/coach`，旧页面文件保留。

## 业务联动

- `saveProject`：项目 + 四类稳定知识卡。
- `analyzeJob`：JD + 分析知识卡。
- `finalizeTraining`：最终回答 + 复盘知识卡 + CoachSession。
- `buildKnowledgeGraph`：知识/项目/岗位/技能节点与关系。

## 外部连接器边界

招聘站点连接器、MCP、公司官网监控、推送和投递仅保留契约或受控本地能力。v0.6.0 不自动绕过登录、验证码、Cookie、风控或平台限制，不自动向招聘方发送消息。
