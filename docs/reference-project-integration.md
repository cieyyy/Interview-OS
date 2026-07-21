# 参考项目功能整合矩阵

本文记录用户指定开源项目如何映射到 Interview OS。当前阶段优先完成统一数据契约、本地业务模块和 UI；外部采集、推送和投递连接器后续逐个启用。

## 产品分层

```text
浏览器扩展 / MCP / API / 公司官网 / 文件导入
                    ↓
        采集任务、原始数据、清洗、去重
                    ↓
      统一职位模型、质量、可信度、公平审计
                    ↓
   搜索计划、实时筛选、匹配排序、岗位对比
                    ↓
简历、话术、投递、面试、公司关注、求职记忆
                    ↓
       市场洞察、报告、推送、职业 Agent
```

## 逐项目映射

| 参考项目 | 提取的核心能力 | Interview OS 对应模块 | 当前状态 |
| --- | --- | --- | --- |
| Xiaolang-d3/bosscopilot | 本地优先岗位分析、材料准备、投递跟踪 | JD 中心、求职管道、定向简历 | 已形成闭环 |
| Formula404/AppliedYet | 投递、简历版本、面试、日程、Offer 关联 | 求职管道、简历工坊、求职日程 | 已实现本地关联 |
| 407928176-spec/jd-greeting | 真实优先、事实清单、输出前自检 | 沟通话术草稿 | 已使用档案证据生成 |
| yynoxrfp/google-jobs-scraper | 聚合搜索、结构化 API、异步批量任务 | Google Jobs API 连接器 | 框架已预留 |
| tliang10/JDMirror | 当前详情页提取、JD 解读、简历匹配 | 浏览器扩展、岗位详情、能力图谱 | 页面提取与详情审阅已实现 |
| 2892480843/TrustHire-AI | JD、简历、证据链、匹配、面试和报告 | 可信度、能力证据、面试训练 | 本地证据链框架已实现 |
| Waterfarke/resume_matching_project | 技能、学历、经验、城市等多维匹配 | 分项匹配、能力图谱 | 确定性分项评分已实现 |
| sidifensen/GraphHire | 能力图谱、可解释匹配、招聘协同 | 能力图谱、求职管道 | 个人求职视角已实现 |
| PKQHA/AI-Recruitment-Intelligence-System | 技能抽取、匹配、知识检索、学习路线 | 能力图谱、补强路线、AI Provider | 本地规则完成，RAG 待接入 |
| gitychzh/jobSpider | BaseScraper、统一调度、Cloudflare/D1 | 多平台采集适配器、运行日志 | 连接器注册表已实现 |
| ZxlDragonDoctor/booss-batch-burial | 关键词过滤、节奏、限额、风控暂停 | 辅助投递框架 | 自动发送保持关闭 |
| ironping794-creator/job-posting-scrape-report | 分页 API、原始数据、清洗、CSV、报告 | 数据中心、结构化输出 | CSV/JSON/报告输出已实现 |
| 25sui/FairMirror | JD 偏见审计、简历防御、合规证据 | 岗位风险与偏见审计 | 规则审计已实现 |
| HA7CH/guoyang-pro | 静态名录 + 实时职位混合架构、招聘日历 | 公司关注、官网目录、招聘时间线 | 本地名录框架已实现 |
| anan-root/careerpilot-agent | 自然语言目标、搜索计划、两阶段匹配、记忆、问答 | 求职 Agent、求职记忆 | 本地 Agent 主线已实现 |
| unclehu72/-APP | 移动端与 Gemini 接入入口 | 移动端适配候选 | 仓库信息不足，暂不单独实现 |
| Neuclic/open-offerflow | 公司官网适配器、新增/变更/关闭追踪 | 公司关注、岗位生命周期 | 监控契约已实现 |
| timrain233/Job_Hunting_Deepseekbased_Analysis-Screening-Tool | 五档岗位分层、规则与 AI 结合、成本控制 | 求职 Agent、筛选规则 | 本地优先排序已实现 |
| Angel749562/python-recruitment-analysis | 薪资、地区、技能、预测和可视化 | 岗位洞察、数据中心 | 统计完成，预测模型待实现 |
| NingNing0111/boss_mcp | BOSS 搜索、详情、企业核验、聊天和简历发送 | BOSS MCP 连接器 | 搜索/详情/投递能力契约已预留 |
| Chinaduanyun/JobsIn | 采集、AI 推荐、文案、Chrome 执行、投递状态 | 岗位工作台、话术、辅助投递 | 除真实执行外已形成框架 |
| hation/JobClaw-AI | 多行业统一职位 JSON、匹配与风险 | 行业分类、统一职位模型 | 13 类行业已支持 |
| sheepking-oss 聚合分析系统 | React/Node/Python 分层、收藏、对比、分析 | 职位池、对比、数据中心 | 桌面端等价模块已实现 |
| A1terevil/data-analysis | 城市、学历、经验、工资和大厂统计 | 岗位洞察 | 基础统计已实现 |
| lyp82nlf/JobRetriever | Search/Processor/Notifier/Scheduler 分层 | 数据源、标准化、推送中心 | 推送通道框架已实现 |
| MaginA0716/Job-Filter-Wizard | Specs、时效、去重、批次控制 | 筛选规则、数据质量 | 本地规则已实现 |
| YE-in01/Recruitment-Assistant | 简历解析、匹配、岗位专项面试题 | 简历工坊、面试训练、能力图谱 | 主线已实现，专项题包待增强 |
| liepin-tech-2026/liepin-job-mcp | 官方职位搜索、详情和鉴权 | 猎聘 MCP 连接器 | 连接器契约已预留 |
| linyshdhhcb/MyApplyDashboard | 多公司招聘官网入口与登录态管理 | 公司官网目录 | 外部打开和关注管理已实现 |

## 当前真实可用

- 本地职位池、去重、字段标准化、薪资归一化、行业和技能提取。
- 匹配分项、匹配理由、可信度、数据质量、风险和偏见提示。
- 求职 Agent 自然语言计划、本地职位池运行、结果问答和求职记忆。
- 公司关注、招聘官网目录、招聘时间线和监控框架验证。
- 职位搜索、组合筛选、收藏、四岗位对比和详情审阅。
- 定向简历、真实沟通话术、投递管道、求职日程和面试训练。
- 城市、行业、技能、薪资、来源、采集日志和数据质量统计。
- CSV、JSON、Markdown 分布报告复制输出。
- 应用内推送规则及外部渠道连接器配置框架。

## 后续真实连接顺序

1. 猎聘官方 MCP 搜索和详情。
2. 公司招聘官网监控适配器。
3. 结构化 JSON API / CSV 批量导入。
4. BOSS 本地登录态搜索和详情。
5. 飞书、企业微信、钉钉、邮件、Telegram 推送。
6. 用户确认后的单岗位辅助投递。
7. AI Top-N 精排、ATS 分析、学习路线和岗位专项面试包。
