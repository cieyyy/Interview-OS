# Interview OS v0.5.0 Obsidian Integration Design

## Goal

Interview OS remains the business source of truth. An Obsidian Vault is an external, editable Markdown view of career knowledge, not a replacement database.

## Phase 1 Scope

- Connect an existing Vault without modifying `.obsidian`.
- Create a dedicated `Interview-OS-Vault` with folders, templates, README, attachment directory, and home index.
- Export projects, incidents, technical knowledge, interview questions and answers, JD analysis, learning plans, company research, retrospectives, and resume metadata.
- Use stable `interview_os_id` frontmatter and a persisted sync index.
- Write through temporary files, flush, and atomically rename.
- Refuse to overwrite a file changed after the last Interview OS export.
- Open a synchronized note through `obsidian://open`.

## Non-Goals

- No Vault import or file watcher in Phase 1.
- No automatic deletion propagation.
- No conflict merge UI.
- No Obsidian plugin installation or `.obsidian` changes.
- No default full-resume export.

## Components

- `ObsidianVaultService`: Vault lifecycle, preview, export, index, diagnostics.
- `obsidian-markdown.ts`: frontmatter, managed/user blocks, WikiLinks, entity mapping.
- Electron IPC: all renderer access to Vault operations.
- `WorkspaceState`: settings, index, conflict queue, and run history.

## Source Of Truth

`WorkspaceState` is authoritative. Vault files are exported views in Phase 1. Existing Interview OS save operations never depend on Vault availability.
