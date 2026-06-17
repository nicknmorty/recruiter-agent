# Operator Testing Runbook

This runbook is for legitimate local testing before using Recruiter Agent on
real private resume, job-search, or application data.

## 1. Preflight

```bash
npm run doctor
npm test
npm run smoke
```

Expected result:

- `npm test` passes all unit tests.
- `npm run smoke` passes against the sanitized support-automation scenario.
- `npm run doctor` exits 0. A `pdftotext` warning is acceptable when testing
  with text, Markdown, or DOCX input; PDF input will fail gracefully without it.

## 2. Fake Scenario Inspection

Use the bundled fake scenario to inspect output shape without private data:

```bash
node bin/recruiter-agent.mjs review \
  --resume examples/support-automation/resume.txt \
  --job examples/support-automation/job-posting.txt \
  --notes examples/support-automation/notes.txt \
  --out runs/examples

node bin/recruiter-agent.mjs research \
  --job examples/support-automation/job-posting.txt \
  --resume examples/support-automation/resume.txt \
  --notes examples/support-automation/notes.txt \
  --topic company \
  --citation-template \
  --out runs/examples

node bin/recruiter-agent.mjs research \
  --job examples/support-automation/job-posting.txt \
  --resume examples/support-automation/resume.txt \
  --notes examples/support-automation/notes.txt \
  --topic company \
  --citations examples/support-automation/citations.json \
  --out runs/examples
```

Review the generated files under `runs/examples/`. The directory is gitignored.

## 3. Private Real-Data Test

Keep real inputs under a private local path outside git, for example:

```text
~/private/recruiter-agent-tests/resume.txt
~/private/recruiter-agent-tests/job-posting.txt
~/private/recruiter-agent-tests/notes.txt
```

Run:

```bash
node bin/recruiter-agent.mjs review \
  --resume ~/private/recruiter-agent-tests/resume.txt \
  --job ~/private/recruiter-agent-tests/job-posting.txt \
  --notes ~/private/recruiter-agent-tests/notes.txt \
  --out runs/private-test
```

Acceptance checks before trusting the result:

- The job-fit explanation says it is an overlap signal, not a hiring decision.
- Every suggested edit preserves the original source claim or asks for proof.
- Missing skills, credentials, dates, locations, compensation, and work
  authorization remain questions unless the user confirms them.
- Private source paths are not printed in saved report metadata; only basenames,
  byte lengths, formats, and SHA-256 digests are persisted.

## 4. Citation Workflow Test

Generate a template:

```bash
node bin/recruiter-agent.mjs research \
  --job ~/private/recruiter-agent-tests/job-posting.txt \
  --resume ~/private/recruiter-agent-tests/resume.txt \
  --topic company \
  --citation-template \
  --out runs/private-test
```

Fill the generated `research-citations-template-*.json` file with dated public
sources. Then attach it:

```bash
node bin/recruiter-agent.mjs research \
  --job ~/private/recruiter-agent-tests/job-posting.txt \
  --resume ~/private/recruiter-agent-tests/resume.txt \
  --topic company \
  --citations runs/private-test/research-citations-template-YYYYMMDDTHHMMSSZ.json \
  --out runs/private-test
```

Acceptance checks:

- Invalid, undated, shortened, tracking, or unclassifiable URLs appear under
  `rejectedCitations`, not `citedFindings`.
- Single-source findings remain medium uncertainty.
- Multi-source corroboration lowers uncertainty only when sources are valid.
- Research findings never become resume evidence by themselves.

## 5. Tracker Workflow Test

Use a private state file for ad hoc testing:

```bash
node bin/recruiter-agent.mjs track add \
  --company "Example Company" \
  --role "Example Role" \
  --status interested \
  --due 2026-06-12 \
  --state runs/private-test/applications.json

node bin/recruiter-agent.mjs track due \
  --on 2026-06-12 \
  --state runs/private-test/applications.json
```

Tracker commands record local state only. There are no external-action verbs
for applying, emailing, uploading, or messaging.

## 6. Do Not Commit

Do not commit:

- Real resumes, job-search notes, or application state.
- Generated `runs/` reports containing private data.
- Generated `state/` or ad hoc tracker files.
- Citation files that include sensitive personal research context unless they
  have been intentionally sanitized.

Before committing any project changes, run:

```bash
git status --short
```

Only source, docs, sanitized examples, and tests should be staged.
