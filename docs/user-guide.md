# Interview OS 使用指南

## 1. 推荐启动方式

当前电脑建议使用便携版，不需要安装，也不会修改系统配置。

在 PowerShell 中运行：

```powershell
powershell -ExecutionPolicy Bypass -File F:\codex_ob\scripts\start-interview-os.ps1
```

该脚本只完成两件事：

1. 启动 `F:\codex_ob\release\Interview-OS-0.4.0-x64-portable.exe`；
2. 把数据目录固定为 `F:\codex_ob\data\interview-os`。

软件不依赖 Docker、WSL、Hyper-V、BIOS 虚拟化、Redis 或 PostgreSQL。

## 2. 两种发布文件

| 文件 | 用途 | 是否安装 |
|---|---|---|
| `Interview-OS-0.4.0-x64-portable.exe` | 当前电脑调试和日常使用 | 否 |
| `Interview-OS-0.4.0-x64-setup.exe` | 后续分发给普通 Windows 用户 | 是 |

当前版本尚未购买代码签名证书。Windows 首次运行可能显示 SmartScreen 提示，应先核对发布文件的 SHA-256，再决定是否运行。

## 3. 上传识别与预填

JD 中心、职业档案和面试知识库均提供“上传识别”入口。支持 PNG、JPG、JPEG、WEBP、PDF、DOC、DOCX、TXT、Markdown、JSON、CSV 和 LOG，单个文件最大 12 MB。

- 文本、Markdown、JSON、CSV、LOG、DOC、DOCX 与文本型 PDF 在本机读取和解析；
- PNG、JPG、JPEG、WEBP 会在用户主动选择后发送到当前启用的视觉 AI Provider；
- 扫描版 PDF 无法提取足够文字时，会在 Provider 已启用的前提下把前 5 页作为图片识别，并在导入结果中明确提示；
- JD、知识和基础档案识别结果会预填到编辑表单；简历中的项目经历会按项目名称去重并自动保存；
- 旧版 Word 如果丢失了视觉文本框中的项目名称，但仍能读取项目描述，会保存为带来源文件名的“待命名项目”，不会猜测名称；
- 请进入“项目经历”逐条核对，使用“编辑”修改角色、背景、架构、职责、行动、难点、技术栈和结果；
- 请核对姓名、年限、公司、岗位、技术名词等字段，再手动保存。

详细识别流程和隐私边界见[简历识别设计](./architecture/resume-recognition.md)。

Sub2API 等 OpenAI 兼容中转服务可以使用。程序会优先调用 `chat/completions`，若网关明确不支持该端点，会自动回退到 `responses`。Base URL 应填写服务商要求的 API 根地址；模型字段必须填写具备图片理解能力且被中转站允许调用的模型 ID。

## 4. 核心使用流程

1. 在“职业档案”填写目标岗位、已有技能和项目经历；
2. 在“知识库”保存技术知识、故障案例和面试表达；
3. 在“JD 中心”粘贴招聘描述，生成能力要求和证据匹配；
4. 在“面试训练”选择目标 JD、项目、中文或 English，以及基础评分或 AI 1V1 陪练；
5. 使用文字或麦克风作答；可让系统朗读题目，并查看教练建议、推荐回答和追问；
6. 查看六个维度评分，修改后将最终回答沉淀到知识库；
7. 在“训练报告”点击历史记录，查看每道题当时如何回答以及对应建议；
8. 在“设置”创建本地备份或导出 Markdown。

### 压力面试闭环

1. 在训练入口选择压力面试、目标 JD、对应项目和 2-8 轮训练上限；
2. 系统一次只展示一个问题，并根据当前回答生成下一轮动态追问；
3. 每轮查看证据缺口、逻辑问题、面试官质疑点和基于已有事实生成的 STAR 建议回答；
4. 需要修改简历时，点击“同步到项目经历”，建议会写入该项目的面试校准记录；
5. 达到轮次上限后查看核心优势、三个高风险漏洞、五个练习问题、简历建议和面试前检查清单；
6. 在训练报告中回看每轮原回答、评分、诊断、动态追问和最终总结。

系统不会为用户编造经历或数据。项目资料中缺失的信息会保留为“【需要本人补充】”，需要本人核实后再写入正式简历。

## 5. AI 联网配置

离线模式已可完成 JD 分析、问题生成和规则评分。需要联网 AI 时，可在“设置”中选择：

- OpenAI 兼容接口；
- 远程 Dify API。

API Key 通过 Electron 安全存储处理，不写入普通工作区 JSON、Markdown 导出或日志。不要把真实 Key 提交到 GitHub。

“测试模型调用”会发送一条最小测试提示词，只有当前 Base URL、API Key、模型名称和生成端点都能正常工作时才显示成功。它与只访问 `/models` 的网络连通检查不同。

顶部“本地优先 · 仅主动使用 AI 时发送所选内容”的含义是：档案、项目、JD、知识和训练记录默认只保存在本机；只有主动使用图片识别或 AI 1V1 陪练时，相关图片或当前问题、回答与选定项目上下文才会发送给设置中启用的 Provider。AI 未启用时，离线题目、评分和本地推荐回答仍可使用。

麦克风按钮使用 Chromium/Windows 提供的语音识别能力，只申请音频权限，不申请摄像头。其可用性受 Windows 语音组件、麦克风权限和网络影响；识别不可用时可继续使用文字输入。

## 6. 数据与恢复

- 通过项目启动脚本运行时，数据位于 `F:\codex_ob\data\interview-os`；
- 开发模式数据位于 `F:\codex_ob\.runtime\workspace`；
- 自动保存采用临时文件写入后替换正式文件，并保留上一版本；
- “设置”页面可生成带 SHA-256 的备份和 Markdown 导出。

如需更换数据盘，可在启动前设置：

```powershell
$env:INTERVIEW_OS_DATA_DIR = 'F:\你的目录'
```

## 7. 开发与测试

```powershell
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run package:win
```

Electron 端到端测试会启动桌面子进程。在 Codex 的受限进程沙箱中需要使用已授权的测试命令；这不是软件本身的运行故障。
