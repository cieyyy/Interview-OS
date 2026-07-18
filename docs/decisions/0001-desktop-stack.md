# ADR-0001：采用 Electron + Vue 3

- 状态：Accepted
- 日期：2026-07-19

## 背景

目标是尽快交付可运行的 Windows EXE。当前机器无法使用 Docker/WSL，已经具备 Node.js 和 VS Code。

## 决策

采用 Electron、Vue 3、TypeScript 和 Vite；通过 electron-builder 打包。

## 结果

优点：开发环境可用、跨平台能力成熟、Playwright 可直接测试 Electron。  
代价：安装包较大，需要持续关注 Electron 安全配置和依赖漏洞。

