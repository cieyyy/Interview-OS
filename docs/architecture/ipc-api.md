# IPC API 设计

## 文档导入

`document:import(target)` 只允许 `job`、`profile`、`knowledge` 三种目标。主进程打开原生单文件选择器，校验文件类型、大小和内容后返回结构化草稿。Renderer 不接收任意文件系统读取能力，也不能直接传入路径。图片识别由主进程调用当前启用的 Provider；导入服务不写入业务数据，最终保存仍由对应页面的显式保存动作完成。

## 1. 原则

- 仅允许预定义 channel；
- 所有参数均为可序列化对象；
- Main 进程验证每个字段；
- 返回统一 `Result<T>`；
- 错误返回稳定错误码，不暴露堆栈和敏感路径。

## 2. API

| Channel | 输入 | 输出 | 说明 |
|---|---|---|---|
| `workspace:get-state` | 无 | `WorkspaceState` | 读取脱敏状态 |
| `workspace:reset-demo` | 无 | `WorkspaceState` | 创建演示数据，仅开发/首次体验 |
| `knowledge:save` | `KnowledgeInput` | `KnowledgeItem` | 新增或更新知识 |
| `knowledge:delete` | `{id}` | `{deleted}` | 删除并清理引用 |
| `project:save` | `ProjectInput` | `ProjectExperience` | 保存项目 |
| `job:analyze` | `JobInput` | `JobDescription` | 本地结构化分析并保存 |
| `training:start` | `TrainingStartInput` | `TrainingSession` | 生成问题 |
| `training:submit` | `TrainingAnswerInput` | `TrainingSession` | 评分并保存回答 |
| `training:finalize` | `TrainingFinalizeInput` | `TrainingSession` | 保存最终回答并回写知识 |
| `backup:create` | 无 | `BackupInfo` | 创建无凭据备份 |
| `export:markdown` | 无 | `ExportInfo` | 导出 Markdown |
| `provider:save` | `ProviderInput` | `ProviderSummary` | Key 经安全存储保存 |
| `provider:test` | 无 | `ConnectionResult` | 用户主动触发连接测试 |
| `app:get-meta` | 无 | `AppMeta` | 版本与数据目录 |

## 3. 错误码

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `STORAGE_ERROR`
- `NETWORK_ERROR`
- `AUTH_ERROR`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `UNSUPPORTED_OPERATION`
- `INTERNAL_ERROR`
