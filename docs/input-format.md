# Input Format Conventions

The `review` command reads plain text, Markdown, or DOCX resumes and optional
plain-text job postings and notes. It is fully deterministic and local: it does
no network calls and sends nothing externally. This document describes the
formatting conventions the deterministic checks understand so you can get the
most accurate review. All examples below are fake.

> Privacy: keep real resumes out of the repo. Put private inputs under the
> git-ignored `runs/` or `state/` directories and never paste real resume
> content into commits, fixtures, or issues.

## Resume input

### Accepted formats

- Plain text (`.txt`)
- Markdown (`.md`)
- DOCX (`.docx`) — text is extracted locally from `word/document.xml` via `unzip`
  and normalized into headings and bullet paragraphs before review.
- PDF (`.pdf`) — extracted locally only when a trusted local extractor
  (`pdftotext` from poppler-utils) is installed. If no local extractor is
  available, the CLI fails gracefully with an actionable message instead of
  attempting unreliable binary parsing; export to text, Markdown, or DOCX in
  that case.

### Section headings

Headings are detected case-insensitively in any of these forms:

- Markdown heading: `## Experience`
- Trailing-colon heading: `Experience:`
- Plain line heading: `Experience`

Recognized section names (and common aliases) include:

- Summary: `Summary`, `Professional Summary`
- Experience: `Experience`, `Work Experience`, `Professional Experience`,
  `Work History`, `Employment History`, `Employment`
- Projects: `Projects`, `Personal Projects`
- Skills: `Skills`, `Key Skills`, `Technical Skills`, `Core Competencies`
- Education: `Education`
- Certifications: `Certifications`

The core-structure check looks for an experience-type section, a skills-type
section, and an education section. Missing core sections are flagged.

### Bullets

Achievement bullets must start with `-`, `*`, or `•` followed by a space:

```
- Reduced support backlog by 40% over two quarters.
* Built an internal tool used by 200 teammates.
• Cut deploy time 5x by automating release checks.
```

Lines that do not start with a bullet marker are treated as prose, not bullets.

### Quantified impact

Bullets are credited with quantified impact when they contain a real metric:
percentages (`40%`), multipliers (`5x`), money (`$50,000`), or scale/outcome
units such as users, customers, people, hours, days, weeks, months, years,
revenue, costs, or savings.

Bare list labels (`item 1`, `phase 2`), date-only mentions (`2020 to 2023`),
and bare counts of generic work items (`3 projects`, `5 tickets`) are **not**
counted as quantified impact, since they read like labels rather than measured
results.

### Action verbs

Bullets that begin with a concrete action verb (built, led, improved, shipped,
reduced, migrated, and similar) score better than bullets that open with weak
or passive phrasing.

### Example resume (fake)

```
# Jordan Lee

## Summary
Operations-focused builder who improves internal tooling and support workflows.

## Professional Experience
- Reduced support backlog by 40% by automating ticket triage.
- Built a release-readiness checklist used by 3 QA teammates.

## Skills
Node.js, JavaScript, workflow automation, documentation

## Education
Example University — B.S. in Information Systems
```

## Job posting input

Provide the job posting as a plain-text file via `--job`. Paste the posting body
as plain text; bullet lists and prose are both fine. The reviewer extracts hard
requirements, nice-to-haves, seniority hints, and domain keywords, and runs a
safety prescreen for prompt-injection, credential/secret requests,
external-action instructions, hidden text, and tracking/scraping links.

Any URLs in the posting also receive a deterministic, offline source-quality
label — `direct_company_domain`, `job_board`, `tracking_or_shortener`, or
`unknown` — based on the host and link pattern only. The reviewer never browses
or researches the company; it just labels what the URL itself reveals.

### Example job posting (fake)

```
ExampleSoft is hiring a Support Automation Analyst to improve support workflows,
build lightweight Node.js tools, and write clear documentation.

Required: JavaScript, Node.js, support operations, ticket triage, workflow
automation, documentation, and clear stakeholder communication.
Nice to have: QA coordination, release readiness.
```

## Notes input

Provide free-form target context via `--notes` as a plain-text file. Notes are
treated as target/constraint context only — never as resume evidence. The
reviewer surfaces notes terms that are not yet visible in the resume so you can
decide whether to add truthful supporting detail.

### Example notes (fake)

```
Targeting support automation roles. Want to emphasize Python and on-call
experience. Constraint: remote-only.
```

## Output

Use `--format text` (default) or `--format json`. Reports open with a prioritized
Top Findings summary, followed by the full breakdown. Use `--out <path-or-dir>`
to save a copy; directory outputs receive dated `resume-review-*.{md,json}`
filenames.
