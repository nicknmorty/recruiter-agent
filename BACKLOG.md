# Backlog

## V0 - Resume Editing

- [x] Write fixtures/examples for fake resume/job/citations before using real
      personal data (`test/fixtures/` plus `examples/support-automation/`).
- [x] Add fixture-based CLI tests for text and JSON report output.
- Define remaining resume input formats beyond plain text, Markdown, DOCX, and
  local PDF extraction.
- Create optional model-assisted review workflows with factuality guardrails.
- Add richer formatting passes that preserve source claims.

## V1 - Job-Aware Resume Assistant

Local-first deterministic V1 is implemented. Remaining items bridge into V2
external research.

- [x] Compare postings to resume evidence through an evidence map.
- [x] Produce a job-fit score with explanation (`jobFit`).
- [x] Generate interview talking points bounded to real evidence.
- [x] Track assumptions and missing information through partial/missing
      requirement statuses and questions.
- [x] Add source-quality labels for job-posting URLs (`jobPostingSources`).
- [x] Generate Bottom Feeder handoff briefs for scoped
      role/company/compensation/workflow/application research.
- [ ] Research the specific job and generic expectations for that role type
      with cited external sources.

## V1 - Known Limitations

A private validation run confirmed the deterministic pipeline works end-to-end
and exposed matching-quality gaps now scoped into V2:

- [x] Exact-token evidence matching was too literal and could under-credit
      equivalent experience. Fixed in V2 Track A.
- [x] Requirement extraction emitted minor noise from abbreviations and bare
      field names. Fixed in V2 Track A.
- [x] No skill synonym or concept normalization. Fixed in V2 Track A.
- [x] Filler suggested edits could produce broken prose; they are now marked in
      place instead.
- [x] Requirement extraction grabbed stopwords/adverbs; stopwords were expanded
      and qualification/responsibility triggers broadened.

## V2 - Smarter Matching + Tailored Application Research

See `docs/V2_SPEC.md`. Track A covers deterministic matching; Track B covers
research packets and cited findings.

### Track A - Smarter deterministic matching

- [x] Curated offline skill/concept lexicon with synonyms
      (`lib/skill-lexicon.mjs`).
- [x] Concept-level evidence matching with explainable `concept` + `matchedVia`
      fields; named languages are not cross-substituted.
- [x] Conservative singular/plural term normalization for near-miss concept
      evidence.
- [x] Requirement quality filter improvements for abbreviation/noise terms.
- [x] Fit recalibration validated on private fixtures with traceable evidence
      maps.
- [ ] Expand lexicon coverage as new postings expose gaps.
- [ ] Optional bounded fuzzy matching for near-miss tokens.

### Track B - Tailored application research

- [x] Generate deterministic application research packets from Bottom Feeder
      handoff briefs (`recruiter-agent research`).
- [x] Build source status, date stamping, uncertainty, risks/caveats, draft
      boundaries, and next actions into Track B packets.
- [x] Add a deterministic citation layer that validates reviewer-supplied
      citations and keeps unsupported claims as `needs_research`.
- [x] Add a fillable citation-template handoff for live source gathering.
- [ ] Research company, compensation, reviews, culture signals, and public role
      context with cited external sources.
- [ ] Generate tailored resume variants and application notes from verified
      inputs only.

## V3 - Application Workflow

- [x] Track applications, statuses, contacts, due dates, and follow-ups with a
      deterministic local-first state file.
- [x] Add a `/recruiter` OpenClaw skill front door with hard no-external-action
      safety rules.
- [x] Add a deterministic tool-dispatch plugin path that shells the CLI through
      a leading subcommand allowlist and no shell invocation.
- [ ] Add job board and email integration research with a read-first design.
- [ ] Require explicit approval gates for every email, application, LinkedIn
      message, or external submission.
- [ ] Produce a skill roadmap from repeated gaps.

## V4 - Product / Extension Lane

- Decide whether to package as an OpenClaw extension, plugin, or standalone app.
- Add privacy review and onboarding.
- [x] Add sanitized end-to-end example scenario plus `npm run smoke` for local
      operator testing before private data.
- [x] Add operator testing runbook for preflight, fake scenario inspection,
      private real-data testing, citation workflow checks, tracker workflow
      checks, and git privacy boundaries.
- Prepare public docs and install flow.
