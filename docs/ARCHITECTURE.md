# Architecture

## Shape

The core stays simple:

- A local CLI accepts resume text or files.
- Workflows produce structured review notes and revised drafts.
- Optional CLI report persistence saves dated artifacts under `runs/` or another caller-provided path.
- Private source inputs stay local and are not committed.

## Components

- CLI: developer entry point in `bin/recruiter-agent.mjs`.
- Deterministic review library: `lib/resume-review.mjs`.
- Workflow layer: future scripts or OpenClaw skills that orchestrate review passes.
- Resume editor skill: workflow contract for critique, formatting, evidence preservation, and revised drafts.
- Job intelligence layer: workflow for posting ingestion, role expectation research, and fit analysis.
- Research layer: future source fetchers and summarizers for jobs, companies, and compensation.
- Bottom Feeder handoff: deterministic CLI brief builder for scoped research passes using the public clawSean workflow.
- State layer: local private state under `state/`.
- Documentation layer: project scope, risks, and runbooks.

## Early Design Principles

- Local-first by default.
- Treat resumes and job histories as sensitive personal data.
- Preserve provenance for edits and recommendations.
- Prefer explicit user approval before sending, publishing, or applying.
- Keep the core small enough to validate manually before building integrations.

## Integration Boundary

Do not build job-board auth, automated applications, or email sending until the local resume and job-analysis loops are useful with fake fixtures and manually supplied postings. Integrations should consume structured outputs from the local core instead of becoming the first implementation surface.

## Implemented

`recruiter-agent review` reads plain-text resume input and optionally a
plain-text job posting. It returns either a text report or structured JSON and
can save the same output with `--out`. Reports include detected sections, resume
keyword signals, deterministic job-posting safety flags, requirement and
nice-to-have signals, seniority hints, missing job keywords, issue severity,
recommendations, and a truthfulness checklist. The current MVP intentionally
uses deterministic checks only so private career data stays local and outputs
are easy to inspect.

`recruiter-agent bottom-feeder` reuses the deterministic review signals to
generate a scoped research brief for the external Bottom Feeder workflow. This
keeps the app local-first while giving future research passes a stable
input/output contract. Bottom Feeder is a public research workflow by clawSean;
recruiter-agent only packages local inputs for that workflow.
