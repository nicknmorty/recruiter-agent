# Upstream Notes

These notes come from a shallow scan of the `MadsLorentzen/ai-job-search` project.

## Reference

- Repository: https://github.com/MadsLorentzen/ai-job-search

## Recommendation

Use the upstream project as architectural inspiration. Do not import or run its agent instructions directly inside an OpenClaw home/workspace.

## Useful Patterns

- Fit evaluation before drafting.
- Separate drafter and reviewer roles.
- Reviewer focuses on company research and critique.
- Application tracker is a first-class artifact.
- PDF compile and visual/layout inspection before final delivery.
- Relevance-weighted resume trimming instead of mechanical oldest-first trimming.

## Safety Findings From Shallow Scan

- The repo is heavily prompt/workflow driven through Claude-specific command, skill, agent, and instruction files.
- The workflow expects access to sensitive career documents such as CVs, LinkedIn exports, diplomas, references, and prior applications.
- Local settings included broad command allowances for Python, curl, and Bun-style execution patterns.
- Setup docs included a remote shell installer path for Bun.
- Deletion/reset flows exist and are guarded by confirmation, but the repo is not appropriate to run casually in a shared assistant workspace.

## Adaptation Notes

- Keep candidate source docs in a dedicated data directory with explicit allowlisted reads.
- Avoid broad command allowlists in normal operation.
- Pass drafts/research inline to reviewer workflows where possible instead of granting broad filesystem access.
- Require confirmation before sending applications, emails, LinkedIn messages, or any public/external action.
- Preserve provenance from source resume facts to generated edits.
