# V2 Spec — Tailored Application Research + Smarter Matching

This document scopes V2. It is informed by a private V1 validation run against
a real resume and real job posting on 2026-06-03, which validated the V1
pipeline end-to-end but exposed concrete matching and extraction limits that V2
must address before any external research is layered on.

## Why V2 (evidence from the V1 run)

The V1 job-aware pipeline ran clean against a real resume + real posting and
produced a fit score, evidence map, and interview talking points. But the run
surfaced honest weaknesses:

1. **Exact-token evidence matching is too literal.** The matcher only credited
   `research` and missed obvious real evidence: the resume shows data science,
   statistics, R programming, Java, SQL, data visualization, and predictive
   analytics, but those did not match literal requirement tokens like `code`,
   `coding`, `classification`, or `quantitative`. Result: an 8/100 fit score
   that understated true fit. The score was honest about being keyword overlap
   only, but it is not yet a *useful* fit signal for differently-worded resumes.
2. **Requirement extraction is keyword-frequency based, not concept based.**
   After the V1.1 stopword/trigger fixes it now extracts real terms
   (`analytical`, `quantitative`, `testing`, `aws`, `classification`, ...), but
   still emits some noise (`e.g`, bare field names like `biology`) and has no
   notion of skill synonyms, abbreviations, or related concepts.
3. **No synonym / concept normalization.** "R programming" should satisfy a
   "coding" requirement; "A/B testing" should satisfy "experimentation";
   "regression" and "classification" are "predictive modeling." V1 cannot see
   any of this.

These are matching-quality problems, not research problems. V2 fixes matching
first, then adds the originally-planned tailored research layer.

## V2 Goals

### Track A — Smarter, still-deterministic matching (highest value)

- **Skill/concept lexicon with synonyms and abbreviations.** A curated,
  offline, reviewable map (e.g. `r`, `python`, `sql` -> coding; `a/b testing`,
  `hypothesis testing` -> experimentation; `regression`, `classification`,
  `forecasting` -> predictive modeling). Lexicon lives in-repo as data, is
  inspectable, and is covered by fixtures.
- **Concept-level evidence matching.** Match requirements to resume evidence
  through the lexicon (stemming + synonym expansion + bounded fuzzy match)
  instead of exact tokens only. Keep the deterministic, no-LLM guarantee.
- **Requirement quality filter.** Drop residual noise tokens (`e.g`, bare
  enumerated field names) and prefer skill-like / multi-word phrases. Keep the
  output reviewable and explain why each requirement was kept.
- **Recalibrated fit score.** Once matching is concept-aware, re-evaluate the
  matched/partial/missing weighting so the score reflects real overlap. The
  score must still ship its "overlap signal, not a hiring decision" disclaimer.

### Track B — Tailored application research (original V2 roadmap)

- Generate deterministic application research packets from the Bottom Feeder
  handoff (`recruiter-agent research`) with dated source checklists, explicit
  uncertainty, draft boundaries, and next actions.
- Produce tailored resume variants and cover-letter / raw-note drafts from
  verified inputs (no invented experience).
- Research company context, compensation signals, benefits, employee-review
  themes, and role fit.
- Attach source links, dates, and explicit uncertainty to every external claim.
- Build source-quality labels and date-stamping for research sources (extends
  the existing `jobPostingSources` labeling to company-research sources).

## Inputs

- V1 resume source + pasted posting (unchanged).
- Optional company name / posting URL for research (Track B).
- Optional target role family for generic role-expectation research.

## Outputs

- Everything from V1, with a concept-aware evidence map and recalibrated fit.
- Optional tailored resume variant (separate from the source resume; never
  overwrites it).
- Optional cover-letter / outreach notes as drafts only — never auto-sent.
- Research packet: company/role context scaffold with source status, dates,
  uncertainty, risks/caveats, and draft boundaries. External facts remain
  `needs_research` until cited sources are attached.

## Guardrails (carried from V0/V1, reaffirmed)

- No LLM dependency for the deterministic core; any future model-assisted layer
  must be clearly separated and optional.
- Never invent experience, metrics, titles, dates, credentials, or skills.
  Synonym matching may only connect a requirement to evidence the user actually
  has; it must not assert unsupported skills.
- No automated applying, emailing, or messaging. External actions stay behind
  explicit human approval gates (this is firmly V3, not V2).
- Research must cite sources and respect sites that prohibit automated access.
  No CAPTCHA-defeating or scraping of disallowed pages (the V1 run already hit
  and respected a job-board CAPTCHA wall).
- Tailored variants and drafts are kept separate from source inputs and stay in
  gitignored local paths (`runs/`, `state/`).

## Acceptance Criteria

- Concept-aware matching credits clearly-equivalent evidence (e.g. "R
  programming" satisfies a coding requirement) on fixture cases, and the change
  is demonstrable on saved private validation fixtures: fit rises from the
  literal-token floor to a defensible number with a traceable evidence map.
- Every concept match is explainable: the report shows which resume phrase
  satisfied which requirement and via which lexicon entry.
- The fit score remains deterministic and reproducible, with its overlap-only
  disclaimer intact.
- Research outputs (Track B) carry sources, dates, and uncertainty, and never
  fabricate company facts.
- Research packets make unresolved external claims explicit as `needs_research`
  rather than presenting source-free company, compensation, or review findings.
- All new behavior is covered by fixtures and golden tests; `npm test` stays
  green; no real personal data enters git.

## Explicitly Not V2

- Automated applications, emails, LinkedIn messages (V3).
- Application/status/deadline tracking workflow (V3).
- Public product packaging / extension lane (V4).
- Any LLM-in-the-loop rewriting of resume prose as the default path.

## Suggested Sequencing

1. Track A first (lexicon + concept matching + fit recalibration). It is the
   highest-value, lowest-risk, fully-offline improvement and directly fixes the
   weakness the private validation run exposed.
2. Then Track B research, starting with deterministic research packets and
   source-quality/date-stamping, before any company-specific cited research.
