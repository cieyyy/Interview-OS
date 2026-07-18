# Changelog

## 0.2.0 - 2026-07-19

### Added

- JD 中心支持上传图片或文件，识别后预填岗位、公司和 JD 原文；
- 职业档案支持上传简历图片或文件，识别后预填基本档案；
- 面试知识库支持上传图片或文件，识别后生成可编辑的知识卡片草稿；
- 本地解析 TXT、Markdown、JSON、CSV、LOG、DOCX 和文本型 PDF；
- 图片识别支持 OpenAI 兼容的 Chat Completions，并自动回退到 Responses API，兼容常见 Sub2API 中转配置。

### Changed

- 移除 Windows 桌面窗口的原生菜单栏；
- 所有导入结果只预填、不自动保存，必须由用户检查确认；
- 单文件大小限制为 12 MB，文件访问仅限用户在系统选择器中主动选择的文件。

### Known limitations

- 扫描版 PDF 暂不直接 OCR，可将页面导出为 PNG/JPG 后通过图片识别；
- 图片识别需要启用具备视觉能力的 AI Provider，内容会发送给该 Provider；
- DOCX 中的复杂排版与内嵌图片不会完整还原。

## 0.1.0 - 2026-07-19

### Added

- 本地优先的职业档案、项目经历和面试知识库；
- JD 离线分析、能力要求提取和证据匹配；
- 面试问题生成、六维评分、重答和知识沉淀；
- 训练报告、原子数据保存、备份和 Markdown 导出；
- OpenAI 兼容接口和远程 Dify Provider 抽象；
- Electron 安全 IPC、上下文隔离和密钥安全存储；
- Windows 安装版和便携版；
- 单元、集成、Electron E2E 和打包产物冒烟测试。

### Known limitations

- 未签名测试发行版；
- 暂无云同步、自动更新、招聘网站连接器和语音面试；
- 暂用 Electron 默认应用图标。
