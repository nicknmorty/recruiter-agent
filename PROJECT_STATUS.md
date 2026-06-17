# Project Status

## Summary

Recruiter Agent has a functioning local CLI for deterministic, offline resume
review, job-aware matching, research-packet scaffolding, citation attachment,
and application tracking. The core workflow does not call an LLM, browse the
web, send messages, submit applications, or upload private career data.

## Current Phase

- Phase: V3 application workflow tracking.
- Status: V1/V2 deterministic core is stable; V3 local-first tracker and
  OpenClaw-facing command front doors are implemented.
- Publication model: this public repo contains sanitized product code,
  examples, docs, and tests. Real resumes, postings, run outputs, citation
  files, and application state belong in private local paths.

## Near-Term Goals

- Continue Track B with cited external research sources for company,
  compensation, reviews, culture, and role context using the generated
  citation-template handoff.
- Expand the skill/concept lexicon as new postings expose gaps.
- Decide remaining file formats beyond plain text, Markdown, DOCX, and local
  PDF extraction.
- Keep public examples fake and boring so users can inspect output safely.
- Prepare the extension/plugin packaging path without weakening privacy
  boundaries.

## Verification

- `npm test` covers deterministic resume review, Bottom Feeder handoff, Track B
  packet behavior, citation validation, and V3 application tracking.
- `npm run smoke` runs the sanitized `examples/support-automation/` scenario
  end-to-end through review, research citation-template generation, citation
  attachment, and application tracking with a temporary state file.
- `npm run doctor` provides a local preflight for Node support, privacy-oriented
  gitignore patterns, sample scenario presence, and optional PDF extractor
  availability.
- `docs/OPERATOR_TESTING.md` documents the repeatable path from preflight to fake
  scenario inspection, private real-data testing, citation attachment, tracker
  workflow checks, and git privacy boundaries.
- Track B citation validation accepts reviewer-supplied citations only when they
  include a parseable URL, value, dated `accessedAt`, and supported source
  quality. Unsupported claims remain `needs_research`.
- V3 application tracking stores deterministic local state in a caller-provided
  or gitignored state file and intentionally has no external-action verbs.
- The OpenClaw skill and plugin surfaces dispatch to the CLI with explicit
  command allowlists.

## Privacy Boundary

Do not commit real resumes, job postings, personal notes, generated reports,
application state, private citation files, local paths, tokens, account IDs, or
operator-specific deployment notes. Use `runs/`, `state/`, or a private path
outside the repo for real testing.
