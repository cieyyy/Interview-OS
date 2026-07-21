# Interview OS

> 当前源码版本：0.5.0

Interview OS 是一款本地优先、AI 增强的 Windows 一体化求职工作台。它把岗位发现、JD 分析、定向简历、投递管理、面试训练、能力补强和职业知识资产组织在同一个本地工作区中。

## v0.5.0 当前能力

- 求职 Agent：把自然语言求职目标转换为搜索计划、筛选条件、推荐岗位和下一步动作。
- 岗位工作台：统一职位池、浏览器可见岗位同步、标准化、去重、筛选、对比、详情和运行日志。
- 岗位洞察与公司关注：地区、行业、技能、薪资趋势，以及目标公司招聘时间线和官网入口。
- 求职管道与日程：收藏、准备、投递、沟通、面试、Offer、截止时间和下一步动作。
- 简历工坊：根据目标 JD、职业档案、项目和技能证据生成定向简历版本。
- 能力图谱：区分已验证能力、相关经验和岗位缺口，输出分项匹配与补强路线。
- 面试训练：中文和全英文模式、语音作答、标准训练、动态压力追问、证据诊断和训练报告。
- Obsidian Phase 1：连接或创建 Vault，预览并单向导出标准 Markdown、稳定 ID、WikiLinks 和冲突保护。
- 数据中心：字段质量、数据源健康度、标准化输出、报告和推送框架。
- 本地安全：原子工作区、备份、Markdown 导出、Electron 安全 IPC 和密钥隔离。

## 当前边界

- 招聘平台真实抓取、MCP、公司官网监控和外部推送仍需逐连接器验收。
- 自动沟通和自动投递保持关闭，任何外部写操作必须由用户确认。
- Obsidian 当前为单向导出；导入、文件监听和双向同步属于后续阶段。
- v0.5.0 Windows 安装版和便携版尚未重新打包，仓库中的既有安装包属于 v0.4.0。

## 开发命令

```powershell
npm install
npm run dev
npm run test
npm run test:e2e
npm run build
npm run package:win
```

## 文档构建

```powershell
python scripts/build_product_docs.py
python scripts/build_product_pdf.py
```

两份脚本均以 `Interview-OS-product-spec-v0.5.0.md` 为唯一内容源，分别生成 DOCX 和 PDF，避免发布文档内容漂移。

## 浏览器岗位同步

1. 启动 Interview OS，进入“岗位同步”。
2. Chrome 打开 `chrome://extensions/` 并启用开发者模式。
3. 加载仓库中的 `browser-extension/` 目录。
4. 在扩展中填写软件显示的本机同步令牌。
5. 打开支持的招聘搜索页，同步当前可见岗位。

扩展不读取密码、不导出 Cookie、不绕过验证码，也不会执行沟通或投递。

## 文档

- [v0.5.0 产品与架构说明](./Interview-OS-product-spec-v0.5.0.md)
- [v0.5.0 发布说明](./docs/releases/v0.5.0.md)
- [v0.5.0 测试报告](./docs/testing/test-report-v0.5.0.md)
- [使用指南](./docs/user-guide.md)
- [系统架构](./docs/architecture/system-design.md)
- [数据设计](./docs/architecture/data-design.md)
- [IPC API](./docs/architecture/ipc-api.md)
- [岗位同步架构](./docs/job-sync-architecture.md)
- [Obsidian 集成设计](./docs/integrations/OBSIDIAN_INTEGRATION_DESIGN.md)
- [参考项目整合说明](./docs/reference-project-integration.md)
- [实施状态与路线图](./docs/roadmap/IMPLEMENTATION_STATUS.md)
- [设计系统](./design-system/interview-os/MASTER.md)

## 测试基线

- 15 个测试文件、55 个单元与集成测试通过。
- Vue/TypeScript 类型检查与生产构建通过。
- Electron 主流程和全模块字体一致性 E2E 通过。
- 打包应用冒烟测试仍待 v0.5.0 产物生成后执行。

## 数据安全

真实 API Key 不得写入源码、`.env`、普通日志或 Git。桌面运行时通过系统安全存储保存密钥。工作区、岗位、简历、投递和训练记录默认只保存在本机；只有用户主动调用 AI、外部连接器或同步功能时，选定内容才会离开本地边界。
