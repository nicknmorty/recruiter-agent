# Bottom Feeder Resource Crawl

Use this runbook for focused knowledge-gathering passes that support Recruiter Agent without turning the project into an unbounded research crawl.

## Inputs

- Target topic: resume editing, job-posting analysis, compensation research, company research, or application workflow.
- Budget: time, source count, and output length.
- Output location: `research/YYYY-MM-DD-topic.md`.
- Optional generated handoff: `node bin/recruiter-agent.mjs bottom-feeder --job <job.txt> [--resume <resume.txt>] [--topic role|company|compensation|workflow|application] --out research`.

## Steps

1. Pick one narrow research question.
   - If a generated handoff exists, use its `Research Questions`, `Job Signals`, `Resume Comparison`, and `Source Plan` sections as the starting scope.
2. Search only source categories relevant to that question.
3. Capture source URLs, dates, and confidence notes.
4. Summarize actionable findings.
5. Add follow-up questions to `BACKLOG.md` if implementation work emerges.

## Output Format

- Date
- Research question
- Sources checked
- Findings
- Risks and caveats
- Suggested next action

## Stop Conditions

- The question is answered well enough for the next project decision.
- Sources conflict and need human judgment.
- The crawl starts collecting personal or account-gated data.
