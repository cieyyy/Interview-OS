# Obsidian Integration User Guide

## Connect An Existing Vault

1. Open **设置与数据**.
2. In **知识库与 Obsidian**, select **连接现有 Vault**.
3. Choose the Vault root directory.
4. Review the work subdirectory and synchronization scope.
5. Select **首次同步预览**.
6. Select **立即同步** after confirming the preview.

Interview OS does not scan the full Vault and does not modify `.obsidian`.

## Create A Dedicated Vault

Select **创建专属 Vault** and choose a parent directory. Interview OS creates `Interview-OS-Vault` with career folders, templates, an attachment folder, README, and a home index. The directory can also be used as a normal Markdown knowledge base.

## Knowledge Page

After a note is saved locally, the knowledge editor shows its sync status and relative Vault path. Available actions are:

- sync the selected note;
- open it in Obsidian;
- copy its WikiLink;
- save locally and then sync.

If the Vault is unavailable, local saving still succeeds.

## Conflict Safety

When a synchronized file has been edited outside Interview OS, the next export reports a conflict and leaves the external file unchanged. Phase 1 does not yet provide a merge screen.

## Disconnect

Disconnecting disables the integration and clears the configured Vault path. It does not delete Interview OS data or Vault files.
