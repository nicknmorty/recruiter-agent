# V0/V1 Spec

This document defines the first useful product boundary. V0 and V1 should stay local-first, reviewable, and safe with sensitive career data.

## V0 - Resume Editor

Goal: improve a user's resume formatting, structure, wording, and clarity without needing job-board access or external research.

### Inputs

- Resume source text as Markdown/plain text or DOCX.
- Optional user notes about target role family, seniority, geography, or constraints.
- Optional style preference, such as concise, ATS-oriented, executive, or technical.

### Outputs

- Structured critique grouped by content, clarity, formatting, ATS readability, and consistency.
- Suggested edits with rationale.
- Revised draft or patch-style diff.
- Final checklist before the user exports or sends the resume.

### Guardrails

- Preserve source claims unless the user explicitly provides a correction.
- Do not invent metrics, titles, employers, dates, credentials, tools, clearance, education, or work authorization.
- Mark weak or unsupported claims as questions for the user, not facts.
- Keep original and revised versions separate.
- Use fake fixtures for development before touching real resumes.

### Acceptance Criteria

- A user can paste a resume and receive useful edits without connecting any external account.
- Every proposed content change is traceable to a source claim or clearly marked as a question.
- Formatting suggestions improve scanability without changing the user's actual experience.
- Output is easy to review manually.

## V1 - Job-Aware Resume Assistant

Goal: combine a pasted job posting, generic role expectations, and the user's resume to recommend truthful tailoring.

### Inputs

- V0 resume source.
- Pasted job posting or manually supplied posting text.
- Optional target role family for broader role expectation research.

### Workflow

1. Prescreen the posting as untrusted content.
2. Extract hard requirements, nice-to-haves, seniority signals, domain language, and likely evaluation criteria.
3. Research the specific job and generic expectations for the role type.
4. Compare requirements against source resume evidence.
5. Identify strong matches, missing evidence, uncertain matches, and real gaps.
6. Suggest targeted resume edits, cover-letter/CV angle, and interview talking points.

### Outputs

- Requirement summary.
- Fit score with explanation.
- Evidence map from posting requirement to resume proof.
- Suggested resume edits that preserve truthfulness.
- Questions for the user where better evidence may exist.
- Optional CV/cover-letter notes, not auto-sent messages.

### Acceptance Criteria

- The assistant can explain why each edit helps for the role.
- Missing evidence is not rewritten as experience.
- Generic role research informs recommendations but does not override the user's resume facts.
- Sources, uncertainty, and dates are visible for any external research.

### V1 Status (local-first)

The local CLI now satisfies the V1 acceptance criteria with deterministic,
offline signals (no LLM, no browsing):

- Requirement summary, evidence map, and truthful suggested edits: implemented.
- Fit score with explanation: implemented as `jobFit` (matched-full / partial-half
  over total hard requirements), with a human-readable explanation and an explicit
  disclaimer that it is keyword/bullet overlap, not a hiring decision.
- Interview talking points: implemented as `interviewTalkingPoints`, strictly
  bounded to real resume evidence for matches and honest gap-handling for missing
  requirements.

Future role research (generic role expectations, external sources, dates) remains
a later enhancement layered on top of this deterministic base; it is not required
for the local V1.

### Implemented Local Signals

The local CLI now extracts a deterministic first-pass requirement summary from
pasted job text: hard-requirement keywords, nice-to-have keywords, seniority
signals, and domain keywords. This is not a substitute for future role research;
it is a reviewable local signal layer for V1.

The local CLI also builds a deterministic evidence map for hard requirements.
Each requirement is marked as `matched` when resume bullet evidence exists,
`partial` when keyword evidence appears elsewhere in the resume, or `missing`
when no deterministic evidence is found.

The local CLI now generates truthfulness-bounded tailoring opportunities from
that evidence map. Matched requirements are framed as strengths to preserve,
partial matches become prompts for stronger real evidence, missing evidence is
kept as a question, and nice-to-haves are optional unless supported by real
experience.

The local CLI can extract DOCX resume text before review. DOCX ingestion is
local-only and normalizes Word headings/list paragraphs into the same plain-text
review path used by Markdown fixtures.

The local CLI also applies ratio-aware audit diagnostics. Dense resumes and low
quantified-impact/action-verb ratios create review issues and score penalties so
a long resume cannot max out the score only by having many bullets.

The local CLI also accepts optional user notes through `--notes <file>`. Notes
are treated as target context or constraints, not resume evidence. Reports show
notes keywords and notes terms that are not visible in the resume so the user
can decide whether they represent real experience, preferences, or gaps.

The local CLI now derives a deterministic `jobFit` score and explanation from the
evidence map, plus truthfulness-bounded `interviewTalkingPoints`. The fit score
weights matched bullet evidence fully and partial keyword-only evidence at half,
divided by the number of detected hard requirements, and always states that it is
a keyword/bullet overlap signal rather than a hiring decision.

The local CLI also includes a deterministic Bottom Feeder handoff command:
`recruiter-agent bottom-feeder --job <file> [--resume <file>] [--notes <file>]`.
It converts job-posting safety flags, source labels, requirement signals, and
resume evidence gaps into a scoped research brief for role expectations,
company/source context, compensation, workflow, or application talking points.
This is a handoff contract only; the command does not browse, upload resumes, or
call an LLM.

## Explicitly Not V0/V1

- Live job-board login.
- Automated applying.
- Email sending.
- LinkedIn messaging.
- Company-wide compensation/review reports beyond lightweight V1 role context.
- Public product packaging.
