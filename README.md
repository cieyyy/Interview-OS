# Interview OS

> 当前版本：0.1.0

Interview OS 是一款本地优先、AI 增强的 Windows 面试知识库桌面应用。

## 当前范围

- 职业档案和项目经历管理；
- 面试知识库；
- JD 结构化和证据化匹配；
- 文字模拟面试、评分、重答和沉淀；
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

- 安装版：`release/Interview-OS-0.1.0-x64-setup.exe`
- 便携版：`release/Interview-OS-0.1.0-x64-portable.exe`
- 本机安全启动脚本：`scripts/start-interview-os.ps1`

启动脚本会把数据固定在本项目的 `data/interview-os` 目录，即 F 盘工作区内。软件不依赖 Docker、WSL、Redis、PostgreSQL 或 BIOS 虚拟化。

## 文档

- [产品设计](./docs/product/README.md)
- [技术架构](./docs/architecture/system-design.md)
- [数据设计](./docs/architecture/data-design.md)
- [IPC API](./docs/architecture/ipc-api.md)
- [测试计划](./docs/testing/test-plan.md)
- [测试报告](./docs/testing/test-report-2026-07-19.md)
- [使用指南](./docs/user-guide.md)

## 数据安全

真实 API Key 不得写入源码、`.env`、普通日志或 Git。桌面运行时使用系统安全存储；测试仅使用内存或假 Provider。
