# 信息架构与核心对象

## 1. 一级导航

```text
工作台
知识库
职业档案
JD 中心
面试训练
训练报告
AI 助手
连接器
设置
```

## 2. 核心对象关系

```text
职业档案
├── 工作经历
├── 项目经历 ──────┐
├── 技能            │
└── 目标岗位        │
                    ↓
JD ───────────→ 面试问题 ─────────→ 训练会话
│                   ↑                  ├── 首次回答
│                   │                  ├── 评分反馈
└── 能力要求        │                  ├── 重答
                    │                  └── 最终回答
知识卡片 ───────────┘                         │
├── 技术知识                                  ↓
├── 故障案例                         回写为面试回答卡片
└── 普通笔记
```

## 3. 对象定义

### 3.1 KnowledgeItem

通用知识对象，包含：

- `id`
- `type`
- `title`
- `contentMarkdown`
- `tags`
- `status`
- `sourceRefs`
- `relatedIds`
- `createdAt`
- `updatedAt`
- `reviewAt`

### 3.2 ProjectExperience

- 基本信息；
- 背景、目标、架构；
- 用户职责；
- 行动与决策；
- 问题与结果；
- 技术栈；
- 证据引用；
- 多时长表达版本。

### 3.3 JobDescription

- 原始文本；
- 来源与公司信息；
- 结构化要求；
- 能力优先级；
- 与用户证据的匹配关系；
- 准备任务。

### 3.4 InterviewQuestion

- 问题正文；
- 类型、难度；
- 目标能力；
- 生成依据；
- 关联 JD、项目和知识；
- 推荐追问。

### 3.5 TrainingSession

- 会话配置；
- 问题顺序；
- 回答历史；
- 分项评分；
- 使用上下文快照；
- 用户确认的最终结果。

### 3.6 Connector

- 类型和版本；
- 能力清单；
- 权限范围；
- 认证引用；
- 健康状态；
- 最后同步时间；
- 错误信息。

## 4. 数据分层

### 用户内容层

Markdown 正文、附件和可导出的结构化数据，是用户真正拥有的资产。

### 应用索引层

全文索引、关系索引、缓存、缩略图和本地数据库，可根据用户内容重建。

### AI 派生层

Embedding、摘要、评分、问题和建议。必须记录模型、提示词版本、输入范围和生成时间。

### 安全凭据层

API Key、OAuth Token 等只保存在系统安全存储中，不进入普通数据库、Markdown、备份和 Git。

## 5. 建议的本地目录

```text
F:\AI-Interview-Stack\Data\InterviewOS
├── workspace
│   ├── knowledge
│   ├── projects
│   ├── jobs
│   ├── interviews
│   └── attachments
├── database
├── indexes
├── cache
├── exports
├── backups
└── logs
```

## 6. 与外部软件的边界

外部软件接入不得直接依赖页面结构或私有数据库。统一通过连接器协议：

```text
桌面应用
   ↓
Connector Service
   ├── Model Provider
   ├── Dify Provider
   ├── Knowledge Importer
   ├── File/Cloud Provider
   └── Future External App Provider
```

每个连接器必须声明：读写能力、数据范围、认证方式、失败重试、限流和撤销方式。
