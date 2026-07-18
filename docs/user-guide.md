# Interview OS 使用指南

## 1. 推荐启动方式

当前电脑建议使用便携版，不需要安装，也不会修改系统配置。

在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File F:\codex_ob\scripts\start-interview-os.ps1
```

该脚本只完成两件事：

1. 启动 `F:\codex_ob\release\Interview-OS-0.1.0-x64-portable.exe`；
2. 把数据目录固定为 `F:\codex_ob\data\interview-os`。

软件不依赖 Docker、WSL、Hyper-V、BIOS 虚拟化、Redis 或 PostgreSQL。

## 2. 两种发布文件

| 文件 | 用途 | 是否安装 |
|---|---|---|
| `Interview-OS-0.1.0-x64-portable.exe` | 当前电脑调试和日常使用 | 否 |
| `Interview-OS-0.1.0-x64-setup.exe` | 后续分发给普通 Windows 用户 | 是 |

当前版本尚未购买代码签名证书。Windows 首次运行可能显示 SmartScreen 提示，应先核对发布文件的 SHA-256，再决定是否运行。

## 3. 核心使用流程

1. 在“职业档案”填写目标岗位、已有技能和项目经历；
2. 在“知识库”保存技术知识、故障案例和面试表达；
3. 在“JD 中心”粘贴招聘描述，生成能力要求和证据匹配；
4. 在“面试训练”选择目标 JD 和项目，回答系统生成的问题；
5. 查看六个维度的本地评分，修改后将最终回答沉淀到知识库；
6. 在“训练报告”查看训练记录和薄弱项；
7. 在“设置”创建本地备份或导出 Markdown。

## 4. AI 联网配置

离线模式已可完成 JD 分析、问题生成和规则评分。需要联网 AI 时，可在“设置”中选择：

- OpenAI 兼容接口；
- 远程 Dify API。

API Key 通过 Electron 安全存储处理，不写入普通工作区 JSON、Markdown 导出或日志。不要把真实 Key 提交到 GitHub。

## 5. 数据与恢复

- 通过项目启动脚本运行时，数据位于 `F:\codex_ob\data\interview-os`；
- 开发模式数据位于 `F:\codex_ob\.runtime\workspace`；
- 自动保存采用临时文件写入后替换正式文件，并保留上一版本；
- “设置”页面可生成带 SHA-256 的备份和 Markdown 导出。

如需更换数据盘，可在启动前设置：

```powershell
$env:INTERVIEW_OS_DATA_DIR = 'F:\你的目录'
```

## 6. 开发与测试

```powershell
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run package:win
```

Electron 端到端测试会启动桌面子进程。在 Codex 的受限进程沙箱中需要使用已授权的测试命令；这不是软件本身的运行故障。
