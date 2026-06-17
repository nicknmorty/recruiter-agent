// Curated, offline skill/concept lexicon for V2 Track A concept matching.
//
// Goal: let deterministic evidence matching recognize that a requirement
// keyword (e.g. "coding") is satisfied by clearly-equivalent resume evidence
// (e.g. "R programming", "SQL", "Java") without any LLM or network call.
//
// Rules of the road:
// - This only connects a requirement to evidence the user ACTUALLY has. It
//   never asserts a skill the resume does not contain.
// - Entries are reviewable plain data. Keep them conservative: only add a
//   synonym when it is a genuine, defensible equivalent or sub-skill.
// - Matching is case-insensitive and phrase-aware; multi-word synonyms are
//   supported and preferred where they reduce false positives.
//
// Shape: each concept maps to an array of synonym/related terms. The concept
// key itself is always treated as one of its own terms.
export const SKILL_LEXICON = {
  // General coding ability. Deliberately excludes specific named languages so
  // that a requirement for one language (e.g. "typescript") is NOT auto-
  // satisfied by evidence of a different language (e.g. "javascript"). Specific
  // languages should match themselves; this concept only covers generic terms
  // and code that demonstrably uses a real language in the resume.
  coding: [
    "code", "coding", "programming", "scripting", "software development",
    "developer", "analytical code", "reviewing code", "writing code",
  ],
  "data science": [
    "data science", "data scientist", "data analysis", "data analytics",
    "analytics", "data-driven", "data mining", "business intelligence",
  ],
  statistics: [
    "statistics", "statistical", "statistical methods", "biostatistics",
    "hypothesis testing", "statistical inference", "inference", "probability",
  ],
  "predictive modeling": [
    "predictive modeling", "predictive model", "machine learning", "ml",
    "regression", "classification", "forecasting", "time-series",
    "time series", "modeling", "models",
  ],
  experimentation: [
    "experimentation", "experiment design", "experimental analysis",
    "a/b testing", "ab testing", "split testing", "hypothesis testing",
    "controlled experiment",
  ],
  optimization: [
    "optimization", "optimize", "operations research", "linear programming",
    "constraint solving",
  ],
  quantitative: [
    "quantitative", "quantitative analysis", "quantitative reasoning",
    "analytical", "analysis", "mathematics", "mathematical", "econometrics",
  ],
  research: [
    "research", "research methods", "scientific reasoning", "investigation",
    "literature review",
  ],
  visualization: [
    "visualization", "data visualization", "dashboards", "dashboard",
    "reporting", "tableau", "power bi", "looker",
  ],
  "cloud-ml": [
    "aws", "gcp", "azure", "sagemaker", "vertex ai", "cloud",
    "ml certification", "ml certifications",
  ],
  communication: [
    "communication", "technical writing", "documentation", "presentations",
    "presentation", "stakeholder communication", "writing",
  ],
  automation: [
    "automation", "workflow automation", "automate", "pipeline", "etl",
  ],
};

export function normalizeSkillTerm(term) {
  const value = String(term || "").trim().toLowerCase();
  if (value.length <= 4) return value;
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (/(?:ses|xes|ches|shes)$/.test(value)) return value.slice(0, -2);
  if (value.endsWith("s") && !/(?:ss|is|us)$/.test(value)) return value.slice(0, -1);
  return value;
}

function termVariants(term) {
  const value = String(term || "").trim().toLowerCase();
  if (!value) return [];
  const variants = new Set([value]);
  const normalized = normalizeSkillTerm(value);
  if (normalized) variants.add(normalized);
  return [...variants];
}

// Reverse index: term -> concept key, for quick lookup. Multi-word terms kept
// intact. Built once at module load.
const TERM_TO_CONCEPT = new Map();
for (const [concept, terms] of Object.entries(SKILL_LEXICON)) {
  for (const term of termVariants(concept)) TERM_TO_CONCEPT.set(term, concept);
  for (const term of terms) {
    for (const key of termVariants(term)) TERM_TO_CONCEPT.set(key, concept);
  }
}

// Given a requirement keyword, return the concept it belongs to (if any) plus
// the full set of equivalent terms to look for in resume text. Always includes
// the original keyword so behavior degrades gracefully for unknown terms.
export function expandRequirementTerms(keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  if (!normalized) return { concept: null, terms: [] };

  const normalizedVariant = normalizeSkillTerm(normalized);
  const concept = TERM_TO_CONCEPT.get(normalized) || TERM_TO_CONCEPT.get(normalizedVariant) || null;
  const termSet = new Set(termVariants(normalized));
  if (concept) {
    for (const term of termVariants(concept)) termSet.add(term);
    for (const term of SKILL_LEXICON[concept]) {
      for (const t of termVariants(term)) termSet.add(t);
    }
  }
  return { concept, terms: [...termSet] };
}

export function conceptForTerm(term) {
  const normalized = String(term || "").trim().toLowerCase();
  return TERM_TO_CONCEPT.get(normalized) || TERM_TO_CONCEPT.get(normalizeSkillTerm(normalized)) || null;
}
