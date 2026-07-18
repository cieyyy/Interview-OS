# 数据设计

## 1. 工作区状态

MVP 使用版本化状态文件：

```json
{
  "schemaVersion": 1,
  "profile": {},
  "projects": [],
  "knowledge": [],
  "jobs": [],
  "trainingSessions": [],
  "settings": {},
  "updatedAt": "ISO-8601"
}
```

## 2. 实体约束

所有实体都有：

- UUID `id`；
- `createdAt` 和 `updatedAt`；
- 用户可见内容长度上限；
- 关联 ID 在删除时进行引用清理；
- 导入数据不直接信任，必须通过 schema 验证。

## 3. 文件布局

```text
InterviewOS/
├── database/
│   ├── state.json
│   ├── state.previous.json
│   └── state.tmp
├── exports/
├── backups/
├── attachments/
├── secure/
│   └── secrets.bin
└── logs/
```

## 4. 敏感数据

不进入 `state.json`：

- API Key；
- OAuth access/refresh token；
- Cookie；
- 系统凭据；
- 用户未授权持久化的完整模型请求。

Provider 配置仅保存：名称、base URL、model、启用状态和安全存储引用。

## 5. 备份格式

备份清单包括：

- `manifest.json`：版本、时间、文件摘要；
- `state.json`；
- Markdown 导出；
- 附件；
- 不含明文密钥。

恢复前先验证 manifest、schema 和摘要，再写入新目录或创建恢复点。

