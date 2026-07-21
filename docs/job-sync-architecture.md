# Interview OS 岗位同步架构

全部参考项目与功能模块的逐项映射见 [参考项目功能整合矩阵](./reference-project-integration.md)。

## 目标

将用户已经打开并登录的招聘网站页面中的可见岗位，实时增量同步到 Interview OS 本地职位池。同步后的岗位可以继续进入：

1. JD 离线分析与证据匹配。
2. 定向简历制作。
3. 岗位面试训练。
4. 求职投递管道与日程。

## 开源项目调研结论

- [BossZhipin-cli](https://github.com/Yht20927/BossZhipin-cli) 使用“浏览器脚本 + 本地 Bridge”复用用户现有登录态，支持职位搜索、去重、匹配和结构化导出。仓库采用 MIT License。
- [ZHONG-Job-Assistant](https://github.com/Young4ever33/ZHONG-Job-Assistant) 使用 Chrome MV3 内容脚本读取 BOSS 可见岗位，并监听页面切换和本地进度。该仓库未提供开源许可证，因此只参考产品边界和公开架构，不复制代码。
- [job-monitor](https://github.com/jerrytian98-max/job-monitor) 描述了定时扫描、关键词过滤、去重和通知，但 README 明确说明当前使用模拟数据，不能作为真实多站点抓取实现。
- [BossCopilot](https://github.com/Xiaolang-d3/bosscopilot) 提供岗位导入、简历差距分析和投递追踪的本地闭环，但刻意不自动抓取招聘网站。
- [liepin-cli](https://github.com/Viy1204/liepin-cli) 使用 Puppeteer/CDP 驱动本机 Chrome，说明登录态持久化、反自动化挑战和限频是专用招聘连接器必须处理的问题。
- [AppliedYet](https://github.com/Formula404/AppliedYet) 将岗位、简历版本、招聘邮件、面试、日程和 Offer 关联到同一次投递，说明同步岗位必须保留稳定 ID，才能支撑下游转化分析。
- [Resume-Optimizer-AI-Agent](https://github.com/LeonZou814/Resume-Optimizer-AI-Agent) 使用 JD 驱动简历优化，并采用技能/语义/经验评分与反幻觉校验。Interview OS 当前版本先使用确定性证据匹配和本地项目选择，后续可在现有 Provider 上增加可选的语义评估。
- [JDMirror](https://github.com/tliang10/JDMirror) 证明“当前职位详情提取 → JD 六维解读 → 简历匹配 → 导出报告”适合放在浏览器扩展与本地工作台之间。当前版本采用统一岗位契约和人工纠错边界，不复制其实现。
- [Job-Filter-Wizard](https://github.com/MaginA0716/Job-Filter-Wizard) 将检索和语义提取分层，并使用历史指纹、时效规则和显式 Specs 控制筛选。当前版本据此增加可持久化筛选规则。
- [JobRetriever](https://github.com/lyp82nlf/JobRetriever) 把 Search、Processor、Notifier、Scheduler 分离，统一输出 JobItem。当前版本据此拆分数据源、标准化职位、提醒规则和运行日志。
- [Open OfferFlow](https://github.com/Neuclic/open-offerflow) 使用公司官网适配器、本地 SQLite 和新增/变更/关闭状态追踪。当前版本已预留公司官网连接器和岗位生命周期字段。
- [AI Recruitment Intelligence System](https://github.com/PKQHA/AI-Recruitment-Intelligence-System) 将技能抽取、确定性匹配、知识检索和学习路线分层。当前版本只实现本地确定性技能/匹配分析，AI 工作流保留为后续 Provider 能力。
- [TrustHire AI](https://github.com/2892480843/TrustHire-AI) 强调 JD、简历、证据链、评分、面试任务和报告闭环。当前版本把岗位风险、匹配理由、定向简历和面试入口串联起来。
- [JobClaw AI](https://github.com/hation/JobClaw-AI) 给出跨设计、技术、运营等行业的统一 JSON 字段和多维匹配思路。当前版本加入 13 类行业分类，不再只面向技术岗位。
- [boss_mcp](https://github.com/NingNing0111/boss_mcp) 暴露搜索、详情、企业核验、沟通和简历发送能力；[猎聘官方 MCP](https://github.com/liepin-tech-2026/liepin-job-mcp) 提供官方职位搜索与详情接口。当前版本仅建立 MCP 连接器契约，所有沟通和投递动作仍要求人工确认。
- [BOSS 海投助手](https://github.com/ZxlDragonDoctor/booss-batch-burial) 展示了关键词、限额、随机间隔和风控暂停。当前版本只吸收“材料准备、限流和日志”概念，不启用自动海投。

## 采用方案

### Chrome 扩展

`browser-extension/` 是 MV3 只读扩展：

- 读取 BOSS、猎聘、智联、前程无忧和拉勾当前页面中的 JSON-LD 或可见岗位卡片。
- 使用 `MutationObserver` 监听页面更新，5 分钟重新扫描已打开的支持页面。
- 不读取密码，不导出 Cookie，不发送消息，不上传简历，不执行投递。
- 招聘网站页面结构变化后，只需要更新对应站点选择器。

### 本机 Bridge

Electron 主进程监听 `127.0.0.1:19426`：

- `GET /health`：连接检查。
- `POST /jobs`：接收扩展同步批次。
- 只允许无 Origin 的本机测试请求或 `chrome-extension://` Origin。
- 通过工作区同步令牌校验请求。
- 每批最多 100 个岗位、2 MB 数据。

### 去重规则

岗位指纹为：

```text
sha256(sourceSite + "|" + (externalId || sourceUrl))
```

同一指纹再次出现时更新岗位内容、`lastSeenAt` 和 `seenCount`，不会创建重复记录，也不会重置用户已经设置的状态。

## 已落地的产品框架

### 统一职位契约

所有连接器最终写入 `SyncedJob`，除标题、公司、地点、薪资和 JD 外，还包含：

- 行业、用工类型、学历、经验、技能、远程标记。
- 归一化月薪区间、匹配分、匹配理由、可信度和风险标记。
- 新增、活跃、变更、关闭的生命周期状态。

### 连接器注册表

| 连接器 | 当前状态 | 正式启用条件 |
| --- | --- | --- |
| 浏览器可见岗位扩展 | 可用 | 用户加载扩展并填写本地令牌 |
| 猎聘官方 MCP | 框架 | 用户授权 Key、频率限制与返回字段适配 |
| BOSS MCP | 框架 | 本机服务、登录态、回归测试与人工确认策略 |
| 目标公司官网 | 框架 | 为目标公司逐站实现适配器和关闭岗位检测 |
| Google Jobs 聚合 API | 框架 | 选择合规供应商、配置 API Key 和费用上限 |
| CSV / JSON 导入 | 框架 | 增加文件选择和字段映射界面 |

### 筛选、提醒与审计

- 筛选规则支持包含/排除关键词、城市、行业、来源、最低薪资、最低匹配度、最低可信度、远程和新鲜度。
- 提醒规则当前完整支持应用内配置；Webhook 和邮件只保存配置，不发送外部消息。
- 每次浏览器同步和连接器框架验证都会写入运行日志，记录来源、数量、状态和说明。
- 岗位洞察展示最近新增、地区、行业、技能、薪资、来源和任务健康度。

### 求职闭环

```text
数据源 → 标准化职位池 → 筛选/对比/可信度 → JD 中心
     → 定向简历 → 沟通话术草稿 → 人工确认投递 → 求职管道 → 面试训练
```

沟通话术只使用职业档案和已识别技能生成，不编造年限、业绩或项目数字。辅助投递目前仅是状态和接口占位，不会触发招聘网站写操作。

## 安全边界

- 自动同步默认依赖用户已经打开的招聘页面，不尝试绕过登录、验证码、风控或付费限制。
- 扩展只声明五个招聘站点和本机 Bridge 的访问权限。
- 同步数据只写入 Interview OS 本地工作区。
- 自动沟通、批量投递和账号凭据托管不在当前范围内；正式启用任何写操作前必须单独设计限额、审计、暂停和人工确认。
