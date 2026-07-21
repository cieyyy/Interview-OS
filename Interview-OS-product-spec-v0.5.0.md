# Interview OS Product Specification v0.5.0

## Release Theme

Obsidian-compatible career knowledge assets without replacing the existing Interview OS knowledge model.

## Product State

| Capability | Current state |
| --- | --- |
| Interview OS local knowledge base | Real and usable |
| Obsidian dedicated Vault creation | Phase 1 implemented |
| Existing Vault connection | Phase 1 implemented |
| Obsidian one-way export | Phase 1 implemented and unit tested |
| Stable ID and sync index | Phase 1 implemented |
| Obsidian URI opening | Implemented; OS registration requires desktop E2E verification |
| Obsidian import | Not implemented |
| Bidirectional sync | Not implemented |
| File watcher | Not implemented |
| Conflict detection | Phase 1 hash protection implemented |
| Conflict resolution UI | Not implemented |
| Full resume export | Not implemented; metadata only |

## Architecture Rules

1. `WorkspaceState` remains authoritative.
2. Obsidian files use standard Markdown, YAML frontmatter, and WikiLinks.
3. `interview_os_id` is the stable identity key.
4. The renderer never accesses Vault files directly.
5. `.obsidian` is not read or changed.
6. Local saves do not depend on Vault availability.
7. Deletion is never silently propagated.
8. External file modification blocks overwrite.

## Phase 1 User Flow

```text
Settings
-> connect existing Vault or create dedicated Vault
-> choose synchronization scope and folder mappings
-> preview initial export
-> run manual export
-> inspect sync status
-> open a synchronized note in Obsidian
```

Knowledge editing also supports **Save and Sync**. The save completes locally first, then export is attempted.

## Supported Objects

- project experience;
- incident and troubleshooting knowledge;
- technical knowledge;
- interview questions;
- interview answers and training sessions;
- JD analysis;
- learning plan knowledge;
- company research knowledge;
- job-search retrospectives;
- resume metadata and evidence links.

## Data Model Changes

- workspace schema version increased from 1 to 2;
- `WorkspaceSettings.obsidian` added;
- `obsidianSyncIndex` added;
- `obsidianSyncConflicts` added;
- `obsidianSyncRuns` added;
- v0.4.0 workspaces migrate with integration disabled and no data loss.

## Acceptance For Phase 1

- existing and dedicated Vault workflows exist;
- no `.obsidian` mutation;
- folder mappings are configurable and path-safe;
- Markdown contains stable ID and managed/user blocks;
- exports use atomic replacement;
- external changes are not overwritten;
- local use remains available when Vault is unavailable;
- unit tests, type checking, and production build pass.

## Next Phases

Phase 2 adds incremental scanning, frontmatter parsing, rename/move recognition, and import. Phase 3 adds file watching, loop prevention, bidirectional synchronization, and interactive conflict resolution. Phase 4 adds backlink graph APIs and review synchronization.
