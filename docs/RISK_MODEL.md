# Risk Model

## Sensitive Data

- Resume history, employment dates, compensation targets, contact details, job-search intent, and application status.

## Product Risks

- Fabricating or overstating experience.
- Treating low-quality market data as fact.
- Accidentally committing private artifacts.
- Sending applications or outreach without explicit approval.
- Creating tailored resumes that are inconsistent across applications.

## Guardrails

- Keep private run outputs and state ignored by git.
- Require user review before external sends or submissions.
- Preserve original source claims and show suggested changes separately.
- Cite external research and date-stamp time-sensitive claims.
- Use conservative language for uncertain fit and compensation signals.

## Open Questions

- Which resume source format should V0 optimize for first?
- Should the first implementation be pure CLI, OpenClaw skill, or both?
- What minimum tests are needed before using it on real applications?
