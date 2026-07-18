# ADR-0002：MVP 使用版本化原子文件仓库

- 状态：Accepted for MVP
- 日期：2026-07-19

## 背景

MVP 需要本地优先、易备份、易迁移和低安装复杂度。使用原生 SQLite 扩展会增加 Electron ABI 和打包风险。

## 决策

采用版本化 JSON 状态文件、原子替换和 Markdown 导出。Repository 接口与具体存储实现分离。

## 结果

第一版可快速验证闭环；知识量和并发复杂度增加后，可在不修改 UI/领域服务的前提下替换为 SQLite/FTS。

