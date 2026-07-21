# Interview Expression Training

Interview training continues to use `TrainingSession`, `InterviewQuestion`, and `AnswerAttempt` as the source model.

For Obsidian Phase 1:

- completed and active sessions can export as `interview-answer` notes;
- questions and attempts remain linked to their stable session ID;
- related project and JD IDs are included in frontmatter;
- answer knowledge created by finalization can also export from `KnowledgeItem`;
- Obsidian does not become the training execution engine.

Phase 2 may import user edits as proposed answer updates. Phase 3 must detect simultaneous edits before applying changes to training history.
