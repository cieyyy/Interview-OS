# Obsidian Conflict Resolution

## Current Phase 1 Behavior

Interview OS compares the current Vault file hash with the hash recorded at the last successful export.

When they differ:

- the Vault file is not overwritten;
- the index status becomes `conflict`;
- an `ObsidianSyncConflict` record is stored;
- the sync run reports `VAULT_MODIFIED`;
- both workspace and Vault content are retained for future resolution.

## Not Yet Implemented

- field-level comparison;
- keep-workspace / keep-vault actions;
- merge editor;
- duplicate creation;
- soft-delete queue UI;
- automatic import after resolution.

These belong to Phase 3. Until then, users resolve the external file manually or disconnect the note from future sync outside the current UI.

## Deletion Rule

Phase 1 never propagates Vault file deletion into Interview OS. Disconnecting a Vault also leaves all workspace knowledge intact.
