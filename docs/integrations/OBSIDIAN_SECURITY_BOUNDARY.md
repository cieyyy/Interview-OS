# Obsidian Security Boundary

## Enforced

- Renderer code cannot access the Vault file system.
- Directory selection uses Electron dialogs in the main process.
- All file operations run through `obsidian:*` IPC handlers.
- Relative folder mappings reject absolute paths, `.` / `..`, and `.obsidian` segments.
- Resolved paths must remain inside the authorized Vault workspace directory.
- Only generated Markdown, templates, README, and index files are written.
- `.obsidian` is detected only as a directory presence check and is never modified.
- Markdown is serialized as text; scripts are not executed.
- API keys, tokens, and provider secrets are not included.
- Full resume content is not exported by default.

## Operational Limits

- Phase 1 performs manual export only; no background watcher is active.
- Obsidian URI opening is delegated to the operating system.
- File modification conflicts prevent overwrite but do not yet have a merge UI.

## Path Ownership

For an existing Vault, only the configured `workspaceSubdirectory` is managed. For a dedicated Vault, the dedicated Vault root is managed. Sync index paths are stored relative to that root.
