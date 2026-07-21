# Resume Evidence Model

`ResumeVariant` references existing projects, skills, and target JD data instead of duplicating evidence.

## Obsidian Phase 1

Resume synchronization is metadata-only:

- version name;
- target role;
- summary of changes;
- target keywords;
- project evidence links;
- match score;
- status and version number.

The complete resume body is not exported. `syncFullResume` remains disabled in the UI until a dedicated privacy review and explicit export implementation are completed.

## Evidence Links

Project IDs are serialized into frontmatter and rendered as WikiLinks when the project title is available. This keeps resume evidence connected to the same `ProjectExperience` records used by interview training and JD matching.
