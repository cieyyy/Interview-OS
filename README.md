# Interview OS

> 当前源码版本：0.8.5

Interview OS 是一款本地优先、AI 增强的桌面职业操作系统。它把岗位发现、JD 分析、能力成长、定向简历、项目经历、AI 面试训练和投递管理组织在同一个本地工作区中。

## v0.8.5 当前能力

- 工作台：围绕今日任务、训练、待学习技能、活跃机会和目标岗位组织行动。
- AI 职业教练：保留一个面试训练入口，通过陪练模式切换模拟面试、项目深挖、技术问答、简历追问、JD 分析和英语面试。
- 职业档案：统一基础档案与项目经历；项目按一页一个翻阅和编辑。
- 岗位中心：统一职位池、浏览器岗位同步、标准化、去重、筛选、对比、详情、运行日志和高德地图距离校准。
- 求职 Agent：把自然语言求职目标转换为搜索计划、筛选条件、推荐岗位和下一步动作，并支持删除计划及关联运行记录。
- 公司关注：保留目标公司招聘时间线和官网入口。
- 求职管道与日程：收藏、准备、投递、沟通、面试、Offer、截止时间和下一步动作。
- 简历工坊：根据目标 JD、职业档案和项目动态生成核心技能，并支持从实时预览返回编辑。
- 能力成长：聚焦能力证据和补强路线，不再显示岗位审计与匹配分项。
- 训练闭环：中英文训练、语音作答、动态压力追问、证据诊断和训练报告。
- 界面偏好：支持中英文界面偏好、完整近黑主题切换和本机地图服务配置。
- AI Provider：提供 Sub2API 一键模板，自动规范根地址为 `/v1`，支持 OpenAI 兼容的 `/chat/completions` 与 `/responses` 接口。
- 自适应模块：长表单和详情面板约束在可视窗口内并独立滚动，避免内容撑破页面布局。
- 本地安全：原子工作区、备份、Markdown 导出、Electron 安全 IPC 和密钥隔离。

## 当前边界

- 招聘平台 MCP、公司官网监控和外部推送仍需逐连接器验收；浏览器插件已支持列表页识别与详情页补全，但各平台选择器仍需持续维护。
- 自动沟通和自动投递保持关闭，任何外部写操作必须由用户确认。
- 高德地图精确距离需要用户自行配置 Web 服务 Key；未配置时使用本地地址规则降级排序。
- v0.8.5 Windows 安装版和便携版由发布流程生成；首次运行未签名版本前应核对 GitHub Release 资产和 SHA-256。


## 开发命令

```powershell
npm install
npm run dev
npm run test
npm run test:e2e
npm run build
npm run capture:ui
npm run package:win
npm run package:mac
```

## 文档构建

```powershell
python scripts/build_product_docs.py
python scripts/build_product_pdf.py
```

两份脚本均以 `Interview-OS-product-spec-v0.6.0.md` 为唯一内容源，分别生成 DOCX 和 PDF，避免发布文档内容漂移。

## 浏览器岗位同步

1. 启动 Interview OS，进入“岗位同步”。
2. Chrome 打开 `chrome://extensions/` 并启用开发者模式。
3. 加载仓库中的 `browser-extension/` 目录。
4. 在扩展中填写软件显示的本机同步令牌。
5. 打开支持的招聘搜索页，可选择“同步当前页面”或“列表岗位 + 后台详情补全”。

扩展不读取密码、不导出 Cookie、不绕过验证码，也不会执行沟通或投递。

## 文档

- [v0.6.0 产品与架构说明](./Interview-OS-product-spec-v0.6.0.md)
- [v0.6.0 基线审计](./docs/roadmap/V0.6.0_BASELINE_AUDIT.md)
- [v0.6.0 系统架构](./docs/architecture/system-design-v0.6.0.md)
- [v0.6.0 UI 规范](./docs/design/V0.6.0_UI_SPEC.md)
- [v0.5→v0.6 迁移报告](./docs/migrations/V0.5_TO_V0.6_MIGRATION_REPORT.md)
- [v0.6.0 发布说明](./docs/releases/v0.6.0.md)
- [v0.7.0 发布说明](./docs/releases/v0.7.0.md)
- [v0.8.0 发布说明](./docs/releases/v0.8.0.md)
- [v0.8.1 macOS 发布说明](./docs/releases/v0.8.1.md)
- [v0.8.2 Windows 发布说明](./docs/releases/v0.8.2.md)
- [v0.8.3 Windows 发布说明](./docs/releases/v0.8.3.md)
- [v0.8.4 Windows 发布说明](./docs/releases/v0.8.4.md)
- [v0.8.5 Windows 发布说明](./docs/releases/v0.8.5.md)
- [v0.6.0 测试报告](./docs/testing/test-report-v0.6.0.md)
- [v0.6.0 界面截图与视觉审计](./docs/screenshots/v0.6.0/README.md)
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

- 19 个测试文件、93 个单元与集成测试通过。
- Vue/TypeScript 类型检查与生产构建通过。

- Electron 主流程和 12 个主模块字体一致性 E2E 通过。
- Windows 安装包、便携版生成成功，打包应用冒烟测试通过。


## 数据安全

真实 API Key 不得写入源码、`.env`、普通日志或 Git。桌面运行时通过系统安全存储保存密钥。工作区、岗位、简历、投递和训练记录默认只保存在本机；只有用户主动调用 AI、外部连接器或同步功能时，选定内容才会离开本地边界。
