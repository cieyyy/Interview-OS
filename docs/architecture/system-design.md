# 系统架构设计

## 1. 技术选型

| 层级 | 方案 | 理由 |
|---|---|---|
| 桌面容器 | Electron | 当前 Windows 环境无需 WSL/Docker，可成熟打包为 EXE |
| UI | Vue 3 + TypeScript + Vite | 组件化、开发效率高、类型边界清晰 |
| 桌面主进程 | Electron Main + Node.js | 文件、备份、安全存储和网络请求统一留在可信进程 |
| 通信 | 类型化 IPC | Renderer 不直接获得 Node/文件系统权限 |
| 本地存储 | 原子 JSON 状态 + Markdown 导出 | MVP 易迁移、易测试；后续可将索引升级为 SQLite |
| 密钥 | Electron safeStorage | Windows 下使用系统级加密能力，不把 Key 写入普通配置 |
| 测试 | Vitest + Playwright Electron | 覆盖领域逻辑、存储和真实桌面关键路径 |
| 打包 | electron-builder | 生成 Windows NSIS/免安装产物并支持后续签名 |

## 2. 进程边界

```text
┌──────────────── Renderer（不可信 UI）───────────────────┐
│ Vue 页面 / 组件 / 表单 / 展示                           │
│ 只能调用 window.interviewOS 中的白名单 API              │
└────────────────────────┬────────────────────────────────┘
                         │ contextBridge + IPC
┌────────────────────────▼────────────────────────────────┐
│ Preload：输入输出类型约束，不包含业务和凭据              │
└────────────────────────┬────────────────────────────────┘
                         │ ipcMain.handle
┌────────────────────────▼────────────────────────────────┐
│ Main（可信进程）                                         │
│ WorkspaceService / Repository / BackupService           │
│ TrainingService / JD Analyzer / ProviderService         │
│ SecretStore / ConnectorRegistry / LogRedactor           │
└───────┬───────────────────────┬─────────────────────────┘
        │                       │
 本地工作区文件             HTTPS 外部服务
                            ├── OpenAI-compatible API
                            └── Remote Dify API
```

## 3. 安全基线

BrowserWindow 固定配置：

- `nodeIntegration: false`；
- `contextIsolation: true`；
- `sandbox: true`；
- 禁止任意导航和新窗口；
- CSP 限制脚本、样式和网络目标；
- Renderer 不接触文件系统、系统命令或明文 Token；
- IPC 每个入口验证输入长度、类型和允许值。

## 4. 模块划分

```text
src/
├── main/
│   ├── ipc/              IPC 注册与校验
│   ├── services/         工作区、训练、备份、Provider
│   ├── storage/          原子文件仓库与安全存储
│   └── connectors/       OpenAI/Dify 适配器
├── preload/              最小白名单桥接
├── renderer/
│   ├── components/
│   ├── pages/
│   ├── composables/
│   └── styles/
└── shared/
    ├── domain.ts
    ├── ipc.ts
    ├── validation.ts
    └── scoring.ts
```

## 5. 关键设计

### 本地优先

UI 所有写入先提交到本地仓库。AI 请求失败不会回滚或覆盖用户原文。

### 原子保存

写入流程：序列化 → 写临时文件 → `fsync`/关闭 → 同目录原子替换。异常启动时恢复最后有效版本。

### AI 可替换

`AIProvider` 只暴露 `testConnection`、`complete` 和 `stream`（后续）能力。领域服务不引用具体厂商 SDK。

### 连接器最小权限

连接器注册时声明读写能力。MVP 只实现连接测试和显式调用，不后台同步、不自动发送用户材料。

### 可迁移性

全量导出包含 schema 版本、JSON 数据、Markdown 内容和附件；不包含凭据。

## 6. 架构演进

- 当知识量或查询复杂度达到阈值时，引入 SQLite/FTS 作为索引层；
- Markdown 内容仍保持可导出和 Obsidian 兼容；
- 远程同步采用事件日志和冲突检测，不直接复制数据库文件；
- 多智能体只编排明确任务，每次外部写入均经过授权门。

