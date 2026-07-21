# 系统架构设计

> 对应源码版本：v0.5.0

## 1. 技术选型

| 层级 | 方案 | 设计理由 |
| --- | --- | --- |
| 桌面容器 | Electron 37 | Windows 本地运行、文件选择、安全存储和 EXE 打包 |
| UI | Vue 3 + TypeScript + Vite | 组件化、类型约束和快速桌面界面开发 |
| 图标 | Lucide Vue | 保持一致的线性图标体系 |
| 主进程 | Electron Main + Node.js | 文件、Bridge、备份、Provider 和 Vault 操作留在可信进程 |
| 通信 | Context Bridge + 类型化 IPC | Renderer 不获得 Node 或任意文件系统权限 |
| 本地存储 | schema v2 原子 JSON + Markdown 导出 | 易迁移、易备份、易测试，后续可增加 SQLite 索引 |
| 密钥 | Electron `safeStorage` | API Key 不写入普通工作区和导出文件 |
| 测试 | Vitest + Playwright Electron | 覆盖领域逻辑、存储、IPC 服务和真实桌面流程 |
| 打包 | electron-builder | 生成 NSIS 安装版和便携版 |

## 2. 进程与信任边界

```text
Chrome MV3 extension
  -> HTTP 127.0.0.1:19426 + workspace token
  -> JobSyncService

Renderer (untrusted UI)
  -> window.interviewOS allowlist
  -> Preload type boundary
  -> ipcMain handlers
  -> WorkspaceService / ProviderService / ObsidianVaultService
  -> AtomicWorkspaceRepository / safeStorage / selected external services
```

Renderer 只负责展示、输入和调用白名单 API。文件选择、Vault 校验、岗位 Bridge、备份、导出、Provider 请求和外部链接打开均由主进程执行。

## 3. 主进程服务

| 服务 | 职责 |
| --- | --- |
| `WorkspaceService` | 档案、项目、知识、JD、岗位、Agent、公司、投递、简历和训练业务 |
| `JobSyncService` | 回环 HTTP Bridge、同步令牌、请求体限制和岗位批次接收 |
| `ObsidianVaultService` | Vault 校验、目录映射、Markdown 导出、同步索引和冲突保护 |
| `ProviderService` | OpenAI-compatible 与 Dify 请求、连接测试和本地回退 |
| `DocumentImportService` | Word、PDF、RTF、文本、表格和图片识别入口 |
| `AtomicWorkspaceRepository` | schema 迁移、原子保存、上一版本恢复、备份和导出 |
| `SecretStore` | API Key 加密保存与读取 |

## 4. Renderer 模块

```text
工作台
├── 求职 Agent
├── 岗位同步 / 职位池 / 筛选 / 日志
├── 岗位洞察 / 公司关注
├── 职业档案 / 知识库 / JD 中心
├── 求职管道 / 求职日程
├── 简历工坊 / 能力图谱
├── 面试训练 / 训练报告
├── 数据中心 / AI 助手
└── 设置 / Provider / Obsidian
```

所有模块通过 `useWorkspace` 共享脱敏后的 `WorkspaceState`，不直接读写本地文件。

## 5. 核心数据流

### 5.1 岗位流

```text
浏览器扩展或连接器
-> JobSyncService
-> 标准化 / 指纹去重 / 薪资与技能解析
-> 统一职位池
-> 筛选 / 对比 / 审计
-> JD / 定向简历 / 求职管道 / 面试训练
```

### 5.2 求职 Agent 流

```text
自然语言目标
-> 确定性计划解析
-> 本地职位池查询
-> 匹配和风险排序
-> 推荐岗位 / 原因解释 / 下一步动作
-> 求职记忆
```

### 5.3 Obsidian 流

```text
WorkspaceState (authoritative)
-> Markdown serializer
-> initial preview
-> atomic one-way export
-> sync index + content hash
-> external-change conflict protection
```

Phase 1 不从 Vault 导入，不监听文件变化，也不修改 `.obsidian`。

## 6. 持久化与迁移

- `WorkspaceState.schemaVersion` 当前为 2。
- 保存采用同目录临时文件、关闭/同步后原子替换，并保留上一版本。
- schema v1 工作区启动时补齐岗位、Agent、投递、简历、公司关注和 Obsidian 字段。
- 匹配、能力图谱和洞察属于可重新计算的派生结果，不作为独立权威数据源。
- Vault 同步索引保存实体 ID、相对路径和哈希，不保存 Obsidian 配置目录内容。

## 7. 安全基线

- `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- 禁止任意导航和未授权新窗口。
- IPC 对输入类型、长度、枚举和 ID 执行校验。
- Bridge 仅监听 `127.0.0.1`，验证同步令牌和批次限制。
- 扩展不读取 Cookie、密码或验证码，不执行招聘网站写操作。
- Provider 只在用户主动操作时接收选定内容。
- Vault 路径必须位于用户选择的根目录内；外部修改不会被覆盖。
- 自动投递和外部推送默认关闭。

## 8. 服务器边界

当前本地产品、浏览器扩展和 Obsidian 单向导出不需要服务器。以下能力需要域名和服务端：

- 无人值守公司官网/公共 API 调度；
- Webhook、邮件和即时通讯推送；
- 多设备同步、任务队列、失败重试和运行监控；
- 云端 Embedding、RAG 或集中精排。

招聘网站登录态、验证码和浏览器 Profile 应继续保留在本机，不建议上传服务器。

## 9. 验证与发布

- 单元与集成测试：15 个文件、55 个用例。
- 类型检查和生产构建：通过。
- Electron 主流程及全模块字体 E2E：通过。
- v0.5.0 Windows 打包与 `obsidian://` 系统注册：待验证。
