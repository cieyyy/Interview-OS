# Interview OS

> 当前版本：0.4.0

Interview OS 是一款本地优先、AI 增强的 Windows 面试知识库桌面应用。

## 当前范围

- 完整简历导入、项目经历自动识别、去重保存与编辑；
- 面试知识库；
- JD 结构化和证据化匹配；
- 中英文模拟面试、麦克风语音识别、AI 1V1 陪练、推荐回答与重答沉淀；
- 基于目标 JD 和项目经历的 2-8 轮压力面试闭环、动态追问与防重复提问；
- 每轮输出证据缺口、逻辑问题、面试官质疑点、事实约束 STAR 回答和简历修改建议；
- 面试建议可同步到项目经历，训练结束生成优势、风险、练习题与面试前检查清单；
- 可点击回看的训练历史、原回答和改进建议；
- OpenAI 兼容 Provider 与远程 Dify 连接器接口；
- 本地备份、导出和敏感配置隔离。

## 开发命令

```powershell
npm install
npm run dev
npm run test
npm run test:e2e
npm run build
npm run package:win
```

## 当前可用版本

- 安装版：`release/Interview-OS-0.4.0-x64-setup.exe`
- 便携版：`release/Interview-OS-0.4.0-x64-portable.exe`
- 本机安全启动脚本：`scripts/start-interview-os.ps1`

启动脚本会把数据固定在本项目的 `data/interview-os` 目录，即 F 盘工作区内。软件不依赖 Docker、WSL、Redis、PostgreSQL 或 BIOS 虚拟化。

## 文档

- [产品设计](./docs/product/README.md)
- [技术架构](./docs/architecture/system-design.md)
- [数据设计](./docs/architecture/data-design.md)
- [IPC API](./docs/architecture/ipc-api.md)
- [简历识别设计](./docs/architecture/resume-recognition.md)
- [测试计划](./docs/testing/test-plan.md)
- [v0.4 测试报告](./docs/testing/test-report-v0.4.0.md)
- [使用指南](./docs/user-guide.md)
- [版本发布说明](./docs/releases/README.md)

## 数据安全

真实 API Key 不得写入源码、`.env`、普通日志或 Git。桌面运行时使用系统安全存储；测试仅使用内存或假 Provider。
