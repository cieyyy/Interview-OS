# Obsidian Sync Workflow

## Existing Vault

1. User selects a Vault directory through Electron's directory dialog.
2. Main process checks read/write access and detects `.obsidian` without reading or changing it.
3. Only the configured Interview OS subdirectory is created and managed.
4. User previews create/update/conflict/skip actions.
5. User starts a manual export.

## Dedicated Vault

1. User selects a parent directory.
2. Interview OS creates `Interview-OS-Vault`.
3. Folder mappings, `90-附件`, templates, README, and home index are created.
4. No `.obsidian` configuration is generated.

## Export Pipeline

```text
WorkspaceState snapshot
-> entity mapping
-> standard Markdown serialization
-> last-file hash check
-> temporary file write
-> fsync
-> atomic rename
-> sync index update
-> sync run log
```

The index stores entity ID, type, relative path, hash, versions, timestamps, and status. A single entity can be exported independently from the knowledge page.

## Later Phases

- Phase 2: incremental scan and import.
- Phase 3: watcher, bidirectional sync, loop prevention, conflict resolution UI.
- Phase 4: backlink graph and review-task synchronization.
