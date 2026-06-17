# Report Fields

The `review --format json` report is a deterministic, local-first summary of the
resume review. It does not browse, research companies, call an LLM, or invent
resume claims. All examples below are fake.

Suggested edits are deterministic prompts for human review. Treat them as
drafting guidance only: they are not rewritten resume truth, and every suggested
claim must be checked against real experience before use.

## topFindings

Highest-priority findings from the deterministic checks, capped to keep the
report scannable. Findings are ordered by safety risk first, then high-severity
resume issues, missing hard requirements, density/evidence gaps, notes gaps, and
lower-severity wording issues.

Example:

```json
[
  {
    "severity": "medium",
    "category": "job-match",
    "message": "Hard requirements with no resume evidence: stakeholder."
  },
  {
    "severity": "low",
    "category": "wording",
    "message": "Filler phrase detected: responsible for."
  }
]
```

## jobPostingSafety

Prompt-injection and unsafe-instruction prescreen for the supplied job posting.
This is only a deterministic warning layer; it does not decide whether a role is
legitimate.

Example:

```json
{
  "checked": true,
  "risk": "medium",
  "flags": [
    {
      "severity": "medium",
      "type": "external-action",
      "message": "Job posting includes instructions to send a message externally."
    }
  ]
}
```

When no job posting is supplied:

```json
{
  "checked": false,
  "risk": "none",
  "flags": []
}
```

## jobPostingSources

Offline URL source labels found in the job posting. The reviewer labels URLs
from their host and pattern only; it does not open links, scrape pages, or do
company research.

Current labels:

- `direct_company_domain` - likely direct company or organization domain.
- `job_board` - known or likely job-board host.
- `tracking_or_shortener` - shortener, redirect, or tracking-shaped link.
- `unknown` - URL found, but no stronger deterministic label matched.

Example:

```json
{
  "checked": true,
  "urls": [
    {
      "url": "https://careers.examplesoft.test/jobs/123",
      "host": "careers.examplesoft.test",
      "label": "direct_company_domain",
      "reason": "URL appears to be a direct company or organization careers page."
    },
    {
      "url": "https://bit.ly/fake-role",
      "host": "bit.ly",
      "label": "tracking_or_shortener",
      "reason": "URL host is commonly used for shortening, redirects, or tracking."
    }
  ]
}
```

## evidenceMap

Maps detected hard requirements from the job posting back to resume evidence.
Statuses are deterministic:

- `matched` - at least one resume bullet contains the requirement or an
  equivalent term from the skill/concept lexicon.
- `partial` - the requirement (or an equivalent term) appears elsewhere in the
  resume but not in a supporting bullet.
- `missing` - no matching resume evidence was found.

### Concept matching (V2 Track A)

Matching is concept-aware via a curated, offline skill lexicon
(`lib/skill-lexicon.mjs`). A requirement is satisfied by its own keyword OR by
any equivalent term for the same concept (e.g. `classification`,
`regression`, and `forecasting` all map to the `predictive modeling` concept;
`analysis` maps to `quantitative`). Two fields make this explainable and keep
it honest:

- `concept` - the lexicon concept the requirement belongs to (or `null`).
- `matchedVia` - the equivalent term(s) that produced the match, excluding the
  literal requirement keyword. Empty when the match was a direct keyword hit.

Concept matching only connects a requirement to evidence the resume actually
contains; it never asserts a skill the user does not have. Specific named
languages are intentionally NOT cross-substituted (JavaScript evidence does
not satisfy a TypeScript requirement).

Example:

```json
{
  "checked": true,
  "hardRequirements": [
    {
      "keyword": "classification",
      "concept": "predictive modeling",
      "count": 1,
      "status": "matched",
      "matchedKeywords": ["regression", "models"],
      "matchedBullets": [
        "- Utilized cluster, linear regression, and correlation analysis..."
      ],
      "matchedVia": ["regression", "models", "machine learning"]
    },
    {
      "keyword": "aws",
      "concept": "cloud-ml",
      "count": 1,
      "status": "missing",
      "matchedKeywords": [],
      "matchedBullets": [],
      "matchedVia": []
    }
  ]
}
```

## tailoringOpportunities

Truthfulness-bounded opportunities created from the evidence map. These are
questions and recommendations for what to verify or strengthen, not permission
to add unsupported skills, dates, employers, metrics, credentials, or tools.

Example:

```json
{
  "checked": true,
  "items": [
    {
      "type": "missing-evidence",
      "requirement": "stakeholder",
      "recommendation": "Add evidence only if you have real stakeholder-facing work.",
      "question": "Can you point to a real project, audience, or outcome involving stakeholder communication?"
    },
    {
      "type": "bullet-evidence",
      "requirement": "node.js",
      "recommendation": "Keep the Node.js evidence visible and tie it to the target role when truthful.",
      "question": ""
    }
  ]
}
```

## suggestedEdits

Deterministic bullet-level suggestions for weak wording, filler phrasing, and
missing quantified impact. These suggestions are templates for revision, not
validated facts. Replace placeholders and vague metrics only with real evidence.
Each item also includes a tiny deterministic `diff` array for consumers that
want to render before/after changes without reconstructing them from prose.

Example:

```json
{
  "checked": true,
  "items": [
    {
      "type": "replace-filler",
      "before": "- Responsible for weekly support reporting.",
      "suggested": "- Owned weekly support reporting for <team/audience> and improved <real outcome>.",
      "diff": [
        {
          "op": "remove",
          "text": "- Responsible for weekly support reporting."
        },
        {
          "op": "add",
          "text": "- Owned weekly support reporting for <team/audience> and improved <real outcome>."
        }
      ],
      "why": "Replace filler phrasing with ownership, audience, and outcome.",
      "evidenceRequired": [
        "Confirm the audience.",
        "Confirm the real outcome before adding a metric."
      ]
    },
    {
      "type": "missing-quantified-impact",
      "before": "- Built release checklist for QA handoff.",
      "suggested": "- Built release checklist for QA handoff that improved <measured result>.",
      "diff": [
        {
          "op": "remove",
          "text": "- Built release checklist for QA handoff."
        },
        {
          "op": "add",
          "text": "- Built release checklist for QA handoff that improved <measured result>."
        }
      ],
      "why": "Strong bullets usually include action, scope, and result.",
      "evidenceRequired": [
        "Only add a metric if it is true and defensible."
      ]
    }
  ]
}
```

When no resume bullets are detected:

```json
{
  "checked": false,
  "items": []
}
```

## run.sourcePolicy

Persisted report metadata intentionally keeps only source basenames, byte
lengths, input formats, and SHA-256 digests. It omits private directory paths so
saved reports are easier to share for debugging without exposing local folder
structure or account names.

## Doctor Report

`doctor --format json` returns local operator-readiness checks. It does not read
resume/job content and does not perform network calls.

Example:

```json
{
  "schema": "recruiter-agent.doctor.v1",
  "status": "warn",
  "summary": {
    "ok": 6,
    "warn": 1,
    "fail": 0
  },
  "checks": [
    {
      "id": "runs_gitignore",
      "status": "ok",
      "message": "runs/ is gitignored except .gitkeep."
    },
    {
      "id": "pdftotext",
      "status": "warn",
      "message": "pdftotext is not installed; PDF resumes will fail gracefully. Use text, Markdown, or DOCX for testing."
    }
  ]
}
```

Exit behavior:

- `ok` or `warn` exits 0.
- `fail` exits 1.
- Missing `pdftotext` is a warning because PDF extraction is optional and fails
  gracefully.

## Citation Template

`research --citation-template --format json` returns a fillable source-gathering
handoff. It is not itself a verified research result. The `citations[]` records
must be filled with dated public sources, then passed back through
`research --citations <file.json>` for deterministic validation.

Example:

```json
{
  "schema": "recruiter-agent.citation-template.v1",
  "topic": "company",
  "roleTitle": "Support Automation Analyst",
  "allowedSourceTypes": [
    "direct_employer",
    "official_filing",
    "reputable_press",
    "job_board",
    "review_site",
    "compensation_aggregator",
    "other"
  ],
  "allowedConfidence": ["high", "medium", "low"],
  "candidateClaims": ["Company context"],
  "citations": [
    {
      "claim": "Company context",
      "value": "",
      "url": "",
      "sourceType": "other",
      "accessedAt": "2026-06-05",
      "confidence": "medium",
      "quote": ""
    }
  ]
}
```

`research --citations` accepts either this object shape or the original raw
array of citation objects.

## Cited Research Fields

When valid citations are attached, `research --citations --format json` adds:

- `citedAt` - timestamp for the citation validation pass.
- `citedFindings[]` - accepted source-backed claims grouped by `claim`.
- `citationSummary` - accepted/rejected/distinct-claim counts.
- `rejectedCitations[]` - invalid citations and rejection reasons.

Example:

```json
{
  "citationSummary": {
    "accepted": 1,
    "rejected": 1,
    "distinctClaims": 1
  },
  "citedFindings": [
    {
      "claim": "Company context",
      "status": "cited",
      "value": "Example company context.",
      "uncertainty": "medium",
      "note": "Single source; corroborate before relying on it."
    }
  ],
  "rejectedCitations": [
    {
      "errors": ["missing url", "missing accessedAt date"]
    }
  ]
}
```

Rejected citations never become findings. Research findings never become resume
evidence by themselves.

Example:

```json
{
  "pathDetail": "basename_only",
  "digest": "sha256",
  "privatePathsOmitted": true
}
```

## finalDraftChecklist

Structured acceptance checklist for reviewing a final resume draft before it is
sent to an employer. Items are deterministic and require human confirmation;
the reviewer does not mark them complete.

Example:

```json
{
  "checked": true,
  "items": [
    {
      "category": "truthfulness",
      "required": true,
      "item": "Every content change is backed by source resume evidence, user-confirmed notes, or a clearly marked question."
    },
    {
      "category": "job-match",
      "required": true,
      "item": "Each job-specific edit maps to real resume evidence or is left as a user question instead of a claim."
    }
  ]
}
```

## `jobFit`

Deterministic job-fit score derived only from the requirement evidence map
(matched bullet evidence counts full, partial keyword-only evidence counts
half, divided by the number of detected hard requirements). It is a
keyword/bullet overlap signal, not a hiring prediction.

```json
{
  "checked": true,
  "score": 71,
  "band": "moderate",
  "counts": { "matched": 6, "partial": 5, "missing": 1, "total": 12 },
  "explanation": "6 of 12 hard requirements have direct resume bullet evidence, 5 have keyword-only evidence, 1 have no deterministic evidence. ... This deterministic fit signal reflects keyword/bullet overlap only, not a hiring decision."
}
```

- `score` is null and `band` is `unknown` when no job posting is supplied or no
  hard requirements are detected.
- `band` buckets the score: `strong` (>=75), `moderate` (>=50), `emerging`
  (>=25), `low` (<25).

## `interviewTalkingPoints`

Deterministic, truthfulness-bounded interview prep derived from the evidence
map. Matched requirements become strength stories backed by a real resume
bullet; partial matches ask for a stronger real example; missing requirements
are framed as honest gaps to address without overstating experience.

```json
{
  "checked": true,
  "items": [
    {
      "requirement": "node.js",
      "status": "matched",
      "type": "strength-story",
      "talkingPoint": "Be ready to walk through a concrete node.js example from your resume.",
      "evidence": "- Shipped a Node.js reporting script ...",
      "question": null
    },
    {
      "requirement": "stakeholder",
      "status": "missing",
      "type": "address-gap",
      "talkingPoint": "Decide honestly how to address stakeholder if asked; do not overstate experience you do not have.",
      "evidence": "",
      "question": "Do you have transferable or adjacent experience for stakeholder you can speak to truthfully?"
    }
  ]
}
```

## Related Fields

- `evidenceMap` is the source of truth behind `jobFit` and
  `interviewTalkingPoints`.
- `jobPostingSignals` contains the hard requirements, nice-to-haves,
  seniority signals, and domain keywords extracted from the job posting.
- `issues` contains the full deterministic issue list behind some top findings.
- `checklist` keeps the older string-list checklist for compatibility; new
  consumers should prefer `finalDraftChecklist`.
