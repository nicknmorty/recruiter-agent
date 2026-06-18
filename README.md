# recruiter-agent

Recruiter Agent is a local-first project for helping users turn career goals, resumes, job postings, and market research into better application materials and a repeatable job-search workflow.

The project starts as a deterministic CLI and graduates toward an OpenClaw extension only after the workflow is useful, auditable, and safe with personal career data.

## Capabilities

### Resume Editing

- Improve resume formatting, structure, wording, and section ordering.
- Preserve user intent while making accomplishments clearer and more specific.
- Support targeted review passes for content, grammar, ATS readability, and consistency.

### Job-Aware Resume Assistant

- Accept pasted job postings and compare them against the current resume.
- Identify role expectations, required skills, seniority signals, and missing evidence.
- Suggest truthful resume adjustments and supporting interview talking points.

### Tailored Application Research

- Produce tailored resume variants and cover-letter/raw-note drafts.
- Research company context, compensation signals, benefits, employee reviews, and role fit.
- Keep source links, uncertainty, and date-sensitive claims visible.

### Application Workflow

- Track target roles, status, deadlines, contacts, and follow-ups.
- Integrate job boards, email/manual application notes, and recruiter outreach.
- Build a skill roadmap from recurring gaps across postings.

### V4 - Public-Ready Product Lane

- Package the best workflow as an OpenClaw extension or standalone product.
- Add strong privacy boundaries, import/export, user onboarding, and safe defaults.
- Prepare docs, tests, examples, and compatibility notes for broader use.

## Project Shape

- `bin/` - local CLI entry points and developer utilities.
- `docs/` - scope, architecture, data model, research, and risk documentation.
- `research/` - local generated market, workflow, and source-quality notes; ignored by git.
- `skills/` - future OpenClaw skill definitions or task workflows.
- `integrations/` - adapters for job boards, email, document tooling, and APIs.
- `runbooks/` - repeatable operating procedures.
- `runs/` - local run artifacts; ignored by git.
- `state/` - local private state; ignored by git.

## CLI

It is a deterministic, local-first CLI. It does not call an LLM or
send resume/job text anywhere.

```bash
npm run doctor
npm test
npm run smoke
node bin/recruiter-agent.mjs status
node bin/recruiter-agent.mjs doctor --format json
node bin/recruiter-agent.mjs review --resume path/to/resume.txt
node bin/recruiter-agent.mjs review --resume path/to/resume.docx
node bin/recruiter-agent.mjs review --resume path/to/resume.txt --job path/to/job.txt --format json
node bin/recruiter-agent.mjs review --resume path/to/resume.txt --notes path/to/notes.txt
node bin/recruiter-agent.mjs review --resume path/to/resume.txt --out runs
node bin/recruiter-agent.mjs bottom-feeder --job path/to/job.txt --resume path/to/resume.txt --topic role --out research
node bin/recruiter-agent.mjs research --job path/to/job.txt --resume path/to/resume.txt --topic company --out research
```

The `review` command accepts plain text/Markdown resumes, DOCX resumes, PDF
resumes (local `pdftotext` only, otherwise a graceful unsupported error), optional
job postings, and optional user notes. It checks structure, bullets, quantified
impact, action verbs, generic filler phrases, missing target-job keywords, and
notes terms that are not visible in the resume. It also flags overly dense
resumes and low evidence/action-verb ratios so long resumes do not get
rubber-stamped by capped positive signals. Outputs include a score,
a prioritized Top Findings summary (highest-signal issues first: safety
flags, high-severity issues, unmet hard requirements, density/evidence gaps,
then notes/wording), detected sections, user-notes context, job-posting safety flags,
requirement/nice-to-have signals, source labels, requirement evidence mapped
back to resume bullets/keywords, a deterministic job-fit score with an honest
explanation, truthfulness-bounded interview talking points, deterministic
suggested edits, issues, truthfulness-bounded tailoring opportunities,
recommendations, and a structured final-draft acceptance checklist. See `docs/report-fields.md` for
the JSON report field guide.
Use `--out <path-or-dir>` to save a copy; directory outputs receive dated
`resume-review-*.md` or `resume-review-*.json` filenames.

For a fuller sanitized end-to-end run, use `npm run smoke`. It exercises the
fake support-automation scenario in `examples/support-automation/` through
review, research citation-template generation, citation attachment, and
application tracking with a temporary state file.

Use `npm run doctor` for a local preflight before legitimate testing. It checks
Node support, privacy-oriented gitignore patterns for `runs/` and `state/`,
sample scenario files, and optional PDF extraction availability.

## Bottom Feeder Handoff

`recruiter-agent bottom-feeder` creates a deterministic research brief from a
supplied job posting and optional resume/notes context. It does not browse or
call an LLM; it packages the local review signals into a scoped handoff for a
Bottom Feeder research pass. Bottom Feeder is a public research workflow by
clawSean; recruiter-agent only prepares the local handoff packet.

```bash
node bin/recruiter-agent.mjs bottom-feeder --job path/to/job.txt
node bin/recruiter-agent.mjs bottom-feeder --job path/to/job.txt --resume path/to/resume.txt --topic application --format json
node bin/recruiter-agent.mjs bottom-feeder --job path/to/job.txt --out research
```

Topics: `role`, `company`, `compensation`, `workflow`, `application`.
Directory outputs receive dated `bottom-feeder-brief-*.md` or
`bottom-feeder-brief-*.json` filenames.

## Research Packets

`recruiter-agent research` builds on the Bottom Feeder handoff and produces a
deterministic Track B application research packet. It still does not browse or
call an LLM; instead, it creates a dated source checklist, findings scaffold,
draft boundaries, risks/caveats, and next action so an actual research pass can
attach sources without fabricating company facts.

```bash
node bin/recruiter-agent.mjs research --job path/to/job.txt
node bin/recruiter-agent.mjs research --job path/to/job.txt --resume path/to/resume.txt --topic compensation --format json
node bin/recruiter-agent.mjs research --job path/to/job.txt --topic company --citation-template --out research
node bin/recruiter-agent.mjs research --job path/to/job.txt --topic company --citations research/citations.json
node bin/recruiter-agent.mjs research --job path/to/job.txt --out research
```

Topics match `bottom-feeder`: `role`, `company`, `compensation`, `workflow`,
`application`. Directory outputs receive dated `application-research-*.md` or
`application-research-*.json` filenames.

Use `--citation-template` to generate a fillable
`research-citations-template-*.json` file for the live source-gathering pass.
The filled file can be passed back with `--citations <file.json>`. The CLI
accepts either a raw citations array or the richer template object with
`citations[]`, validates each dated source deterministically, and keeps invalid
or unsupported claims out of `citedFindings`.

## Current Status

Core matching and the research-packet layer are implemented as deterministic,
local-first CLI behavior: requirement extraction, concept-aware evidence
mapping, a job-fit score with explanation, interview talking points, handoff
briefs, and source-aware research packets all run offline with no LLM and no
browsing. See `docs/SCOPE.md`.

## Key Docs

- `docs/input-format.md` - resume, job-posting, and notes formatting conventions with fake examples.
- `docs/OPERATOR_TESTING.md` - local preflight and legitimate testing workflow.
- `docs/report-fields.md` - JSON report fields, deterministic suggestions, and fake examples.
- `docs/SAFETY_BOUNDARIES.md` - privacy, prompt-injection, and external-action rules.
