# Interview OS 0.5.0 测试报告

## 1. 测试结论

v0.5.0 已完成类型检查、单元与集成测试、Electron 主流程、全模块字体一致性检查、生产构建、Windows 打包与成品冒烟。岗位、Agent、投递、简历、训练与 Obsidian Phase 1 的本地逻辑通过自动化验证，安装版和便携版达到发布条件。

## 2. 自动化结果

| 测试项 | 结果 | 证据 |
| --- | --- | --- |
| Vue / TypeScript 类型检查 | 通过 | 0 错误 |
| 单元与集成测试 | 通过 | 15 个文件，55 个用例 |
| 生产构建 | 通过 | Electron Main、Preload 与 Vite Renderer 构建完成 |
| Electron 主用户流程 | 通过 | 本地工作区完整流程通过 |
| 全模块字体一致性 E2E | 通过 | 15 个模块无小于 11px 的可见文字 |
| 打包应用冒烟 | 通过 | 成品可启动并在隔离目录写入数据、导入 Markdown |
| 生产依赖漏洞检查 | 通过 | `npm audit --omit=dev` 报告 0 个漏洞 |
| Git 差异格式检查 | 通过 | `git diff --check` 无错误 |

## 3. 功能覆盖

- 求职目标解析、计划保存、本地职位池运行、推荐岗位和求职记忆。
- 岗位批次接收、标准化、指纹去重、技能提取、薪资解析和生命周期状态。
- 七维匹配、可信度、数据质量、风险和偏见提示。
- 投递机会、状态历史、定向简历版本和公司关注。
- 中文/英文训练、压力追问、训练诊断和简历校准。
- Obsidian Markdown 序列化、稳定 ID、WikiLinks、受管块和目录映射。
- 专用 Vault 创建、现有 Vault 校验、同步预览、原子导出、同步索引和冲突保护。
- schema v1 到 v2 的工作区迁移和默认字段补齐。

## 4. UI 验证

- 工作台、求职 Agent、知识库、岗位同步、岗位洞察、公司关注、求职管道、简历工坊、能力图谱、数据中心、日程、训练、报告、AI 助手和设置页面均已截图复核。
- 所有模块使用统一 Microsoft YaHei UI / Segoe UI 字体栈。
- 可见文字不小于 11px；正文、表单、标签、分组标题和页面标题使用共享语义字号。
- 未发现文字重叠、按钮撑破、表格错位或表单标签截断。

## 5. 安全验证

- Electron 保持 `contextIsolation: true`、`nodeIntegration: false` 和 `sandbox: true`。
- Renderer 不直接访问文件系统、Vault 或密钥。
- 本机岗位同步只监听回环地址，并验证同步令牌、批次大小和请求体。
- Obsidian 路径经过规范化和目录穿越检查，不创建或修改 `.obsidian`。
- 外部 Markdown 修改后不会被静默覆盖。
- 自动沟通、批量投递和外部推送未默认启用。

## 6. 待验证事项

- NSIS 安装器的交互式安装和卸载流程未执行，避免修改当前系统；`win-unpacked` 成品启动与写入已通过自动化验证。
- 安装 Obsidian 后的 `obsidian://` URI 注册和打开笔记行为。
- 真实招聘平台连接器的授权、页面变化、验证码、限频和失败恢复。
- Obsidian Phase 2 导入与 Phase 3 双向同步场景。

## 7. 发布判断

源码、自动化测试和 Windows 发布产物均满足发布条件，可以创建 v0.5.0 GitHub Release。安装包未使用商业代码签名证书，用户运行前应核对 SHA-256。

## 8. 发布产物

| 产物 | 大小 | SHA-256 |
| --- | ---: | --- |
| `Interview-OS-0.5.0-x64-setup.exe` | 108.68 MiB | `B306EB5FF1AF97C3A929CC7B8A806BC1F7A9075795EAAF7D0D6DF6E7A1A09AC0` |
| `Interview-OS-0.5.0-x64-portable.exe` | 93.99 MiB | `7C1634A45AF530F3E8C9C331CB1994F45AF3930908F7E3221BC61C2378114BBE` |

校验文件：`release/SHA256SUMS-v0.5.0.txt`。
