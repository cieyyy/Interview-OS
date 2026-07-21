# IPC API 设计

> 对应源码版本：v0.5.0

## 1. 原则

- Renderer 只能调用 `window.interviewOS` 暴露的白名单方法。
- Main 进程验证类型、长度、枚举、ID 和路径边界。
- 返回统一 `Result<T>`，错误使用稳定错误码，不暴露堆栈或敏感路径。
- 文件路径由主进程系统选择器产生，Renderer 不能提交任意路径。
- Provider、岗位 Bridge 和 Obsidian Vault 均保持在可信进程。

## 2. 工作区与职业资产

| Channel | 输入 | 输出 |
| --- | --- | --- |
| `workspace:get-state` | 无 | `WorkspaceState` |
| `workspace:reset-demo` | 无 | `WorkspaceState` |
| `profile:save` | `ProfileInput` | `CareerProfile` |
| `project:save` | `ProjectInput` | `ProjectExperience` |
| `knowledge:save` | `KnowledgeInput` | `KnowledgeItem` |
| `knowledge:delete` | `id` | `{ deleted }` |
| `job:analyze` | `JobInput` | `JobDescription` |

## 3. 岗位、Agent 与机会管理

| Channel | 输入 | 输出 |
| --- | --- | --- |
| `job-sync:status` | 无 | `JobSyncBridgeStatus` |
| `job-sync:promote` | `id` | `JobDescription` |
| `job-sync:update-status` | `id, status` | `SyncedJob` |
| `job-source:save` | `JobSourceInput` | `JobSourceConfig` |
| `job-source:validate` | `id` | `JobSyncRun` |
| `job-filter:save` | `JobFilterPresetInput` | `JobFilterPreset` |
| `job-alert:save` | `JobAlertRuleInput` | `JobAlertRule` |
| `career-search-plan:save` | `CareerSearchPlanInput` | `CareerSearchPlan` |
| `career-search-plan:run` | `id` | `CareerAgentRun` |
| `career-memory:save` | `CareerMemoryInput` | `CareerMemoryItem` |
| `company-watch:save` | `CompanyWatchInput` | `CompanyWatch` |
| `company-watch:validate` | `id` | `CompanyWatch` |
| `application:save` | `JobApplicationInput` | `JobApplication` |
| `resume-variant:save` | `ResumeVariantInput` | `ResumeVariant` |

## 4. 面试、导入与 Provider

| Channel | 输入 | 输出 |
| --- | --- | --- |
| `training:start` | `TrainingStartInput` | `TrainingSession` |
| `training:submit` | `TrainingAnswerInput` | `TrainingSession` |
| `training:finalize` | `TrainingFinalizeInput` | `TrainingSession` |
| `training:coach` | `TrainingCoachInput` | `TrainingCoachResult` |
| `document:import` | `DocumentImportTarget` | `DocumentImportResult` |
| `provider:save` | `ProviderInput` | `ProviderConfig` |
| `provider:test` | 无 | `ConnectionResult` |
| `backup:create` | 无 | `BackupInfo` |
| `export:markdown` | 无 | `ExportInfo` |
| `app:get-meta` | 无 | `AppMeta` |

## 5. Obsidian

| Channel | 输入 | 输出 |
| --- | --- | --- |
| `obsidian:select-vault` | 无 | `ObsidianVaultCheck` 或取消 |
| `obsidian:create-vault` | 无 | `ObsidianVaultCheck` 或取消 |
| `obsidian:test-vault` | 无 | `ObsidianVaultCheck` |
| `obsidian:get-settings` | 无 | `ObsidianIntegrationSettings` |
| `obsidian:update-settings` | 设置输入 | `ObsidianIntegrationSettings` |
| `obsidian:preview-initial-sync` | 可选范围 | `ObsidianSyncPreview` |
| `obsidian:run-sync` | 可选范围 | `ObsidianSyncRun` |
| `obsidian:get-status` | 无 | `ObsidianIntegrationStatus` |
| `obsidian:open-note` | `entityId` | `ObsidianNoteLocation` |
| `obsidian:open-folder` | 无 | 打开结果 |
| `obsidian:copy-wikilink` | `entityId` | WikiLink |
| `obsidian:disconnect` | 无 | 重置后的设置 |

## 6. 文档导入边界

`document:import` 只允许 `job`、`profile` 和 `knowledge`。主进程打开原生单文件选择器并验证扩展名、大小和内容。图片或扫描 PDF 只有在用户主动选择且启用视觉 Provider 时才会发送到外部模型。

## 7. 错误码

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `STORAGE_ERROR`
- `NETWORK_ERROR`
- `AUTH_ERROR`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `UNSUPPORTED_OPERATION`
- `INTERNAL_ERROR`
