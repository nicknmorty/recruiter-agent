import { expandRequirementTerms, normalizeSkillTerm } from "./skill-lexicon.mjs";

const DEFAULT_SECTIONS = [
  "summary",
  "professional summary",
  "experience",
  "work experience",
  "professional experience",
  "work history",
  "employment history",
  "employment",
  "projects",
  "personal projects",
  "skills",
  "key skills",
  "technical skills",
  "core competencies",
  "education",
  "certifications",
];

const CORE_SECTION_ALIASES = {
  experience: ["experience", "work experience", "professional experience", "work history", "employment history", "employment"],
  skills: ["skills", "key skills", "technical skills", "core competencies"],
  education: ["education"],
};

const ACTION_VERBS = [
  "built",
  "created",
  "delivered",
  "designed",
  "drove",
  "improved",
  "increased",
  "launched",
  "led",
  "managed",
  "migrated",
  "optimized",
  "reduced",
  "shipped",
  "supported",
];

const FILLER_PHRASES = [
  "hard worker",
  "team player",
  "detail-oriented",
  "responsible for",
  "worked on",
  "helped with",
];

const COMMON_STOPWORDS = new Set([
  // Articles, conjunctions, prepositions, pronouns, and other function words.
  "a", "about", "above", "across", "after", "against", "all", "also", "am",
  "an", "and", "any", "are", "aren", "as", "at", "avoid", "be", "because",
  "been", "being", "below", "between", "both", "but", "by", "can", "cannot",
  "could", "did", "do", "does", "doing", "done", "down", "during", "each",
  "either", "every", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "may",
  "me", "might", "more", "most", "much", "must", "my", "myself", "no", "nor",
  "not", "now", "of", "off", "on", "once", "only", "or", "other", "others",
  "our", "ours", "ourselves", "out", "over", "own", "per", "same", "shall",
  "she", "should", "so", "some", "such", "than", "that", "the", "their",
  "theirs", "them", "themselves", "then", "there", "these", "they", "this",
  "those", "through", "to", "too", "under", "until", "up", "upon", "us",
  "very", "was", "we", "were", "what", "when", "where", "whether", "which",
  "while", "who", "whom", "whose", "why", "will", "with", "within", "without",
  "would", "you", "your", "yours", "yourself", "yourselves",
  // Common job-posting boilerplate adjectives/adverbs and connective filler
  // that are not real hard requirements on their own.
  "able", "actually", "adjacent", "capable", "clear", "comfort", "comfortable",
  "complex", "directly", "experience", "experienced", "hands-on", "help",
  "hold", "increasingly", "like", "looking", "new", "part", "practical",
  "providing", "real", "real-world", "relevant", "set", "some", "state",
  "still", "strong", "team", "various", "well", "whether", "work", "working",
  // Posting structural words and earlier fixture-tuned entries.
  "constraint", "constraints", "hiring", "include", "includes", "including",
  "need", "needs", "preferred", "required", "requirement", "requirements",
  "responsibilities", "responsibility", "role", "roles", "skill", "skills",
  "target", "targets", "qualification", "qualifications", "plus",
  // Inline-example markers and bare connectors that leak from "e.g." lists.
  "e.g", "eg", "i.e", "ie", "etc", "such", "equivalent", "demonstrated",
]);

const JOB_POSTING_SAFETY_RULES = [
  {
    type: "prompt-injection",
    severity: "high",
    pattern: /\b(ignore|override|forget)\b.{0,40}\b(instructions?|rules?|prompt|policy|policies)\b/i,
    message: "Prompt-like instruction tries to override assistant rules.",
  },
  {
    type: "prompt-injection",
    severity: "high",
    pattern: /\b(system prompt|developer message|hidden instructions?|reveal your instructions?)\b/i,
    message: "Posting references assistant prompts or hidden instructions.",
  },
  {
    type: "credential-request",
    severity: "high",
    pattern: /\b(api keys?|passwords?|secrets?|tokens?|credentials?|private keys?|ssh keys?)\b/i,
    message: "Posting asks for, or references, sensitive credentials.",
  },
  {
    type: "external-action",
    severity: "medium",
    pattern: /\b(apply on behalf|submit (an )?application|send (an )?email|message (the )?recruiter|upload (a )?resume|click (the )?link)\b/i,
    message: "Posting contains external-action instructions that require user approval.",
  },
  {
    type: "tracking-or-scraping",
    severity: "medium",
    pattern: /\b(tracking pixel|web beacon|scrape this|crawler|automated scraping)\b/i,
    message: "Posting may include tracking or scraping concerns.",
  },
  {
    type: "hidden-or-irrelevant-text",
    severity: "medium",
    pattern: /<!--|display\s*:\s*none|opacity\s*:\s*0|font-size\s*:\s*0|hidden instructions?|invisible text|white text|data-prompt/i,
    message: "Posting may contain hidden or irrelevant prompt-like text.",
  },
  {
    type: "tracking-or-scraping",
    severity: "medium",
    pattern: /https?:\/\/\S*(?:utm_|gclid|fbclid|tracking|pixel)|\b(?:bit\.ly|tinyurl\.com|t\.co)\//i,
    message: "Posting includes tracking parameters or shortened redirect links.",
  },
];

function normalizeWhitespace(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function splitLines(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function detectSections(lines) {
  const found = new Set();
  for (const line of lines) {
    const normalized = line.replace(/^#+\s*/, "").replace(/:$/, "").toLowerCase();
    if (DEFAULT_SECTIONS.includes(normalized)) found.add(normalized);
  }
  return [...found].sort();
}

function bulletLines(lines) {
  return lines.filter((line) => /^[-*•]\s+/.test(line));
}

function tokenizeKeywords(text) {
  const matches = normalizeWhitespace(text).toLowerCase().match(/[a-z][a-z0-9.+#-]{2,}/g) || [];
  const counts = new Map();
  for (const rawToken of matches) {
    const token = rawToken.replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/gi, "");
    if (token.length < 3) continue;
    if (COMMON_STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([keyword, count]) => ({ keyword, count }));
}

function topKeywords(text, limit = 20) {
  return tokenizeKeywords(text).slice(0, limit);
}

function sentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function keywordsFromMatchingSentences(text, pattern, limit = 12) {
  const matchingText = sentences(text)
    .filter((sentence) => pattern.test(sentence))
    .join(" ");
  return topKeywords(matchingText, limit);
}

function extractSenioritySignals(text) {
  const normalized = normalizeWhitespace(text);
  const patterns = [
    /\b(?:junior|entry[- ]level|mid[- ]level|senior|staff|principal|lead|manager)\b/gi,
    /\b\d+\+?\s*(?:years?|yrs?)\b/gi,
  ];
  const signals = new Set();
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      signals.add(match[0].toLowerCase());
    }
  }
  return [...signals].sort();
}

function extractJobPostingSignals(jobText) {
  const normalizedJob = normalizeWhitespace(jobText);
  if (!normalizedJob) {
    return {
      checked: false,
      hardRequirements: [],
      niceToHaves: [],
      senioritySignals: [],
      domainKeywords: [],
    };
  }

  return {
    checked: true,
    hardRequirements: keywordsFromMatchingSentences(
      normalizedJob,
      /\b(required|required skills|must have|minimum qualifications?|qualifications?|requirements?|responsibilit(?:y|ies)|experience (?:with|in)|proficien\w*|expertise|need|needs)\b/i
    ),
    niceToHaves: keywordsFromMatchingSentences(
      normalizedJob,
      /\b(preferred|nice[- ]to[- ]have|bonus|plus|nice to have)\b/i
    ),
    senioritySignals: extractSenioritySignals(normalizedJob),
    domainKeywords: topKeywords(normalizedJob, 12),
  };
}

// Deterministic, offline source-quality labels for any URLs in a job posting.
// No network calls or company research: classification is by host/pattern only.
const SHORTENER_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly", "rebrand.ly",
  "is.gd", "cutt.ly", "lnkd.in",
]);
const JOB_BOARD_HOSTS = new Set([
  "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com",
  "monster.com", "dice.com", "greenhouse.io", "lever.co", "workday.com",
  "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "jobvite.com",
  "workable.com", "angel.co", "wellfound.com", "builtin.com", "simplyhired.com",
]);
const TRACKING_PARAM = /[?&](?:utm_[a-z]+|gclid|fbclid|mc_eid|mc_cid)=/i;

function rootDomain(host) {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

function extractJobPostingSources(jobText) {
  const normalizedJob = normalizeWhitespace(jobText);
  if (!normalizedJob) {
    return { checked: false, urls: [] };
  }

  const seen = new Set();
  const urls = [];
  const matches = normalizedJob.match(/https?:\/\/[^\s)\]}>"']+/gi) || [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;:]+$/, "");
    if (seen.has(url)) continue;
    seen.add(url);

    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      urls.push({ url, host: null, label: "unknown", reason: "URL could not be parsed." });
      continue;
    }

    const root = rootDomain(host);
    const looksLikeDomain = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host) && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    let label;
    let reason;
    if (SHORTENER_HOSTS.has(host) || SHORTENER_HOSTS.has(root) || TRACKING_PARAM.test(url)) {
      label = "tracking_or_shortener";
      reason = "Shortened or tracking link; the true destination is not visible from the URL.";
    } else if (JOB_BOARD_HOSTS.has(host) || JOB_BOARD_HOSTS.has(root)) {
      label = "job_board";
      reason = "Recognized third-party job board or applicant-tracking host.";
    } else if (looksLikeDomain) {
      label = "direct_company_domain";
      reason = "Not a known job board or shortener; likely a direct company domain.";
    } else {
      label = "unknown";
      reason = "Host could not be classified (no recognizable domain, IP literal, or local host).";
    }
    urls.push({ url, host, label, reason });
  }

  return { checked: true, urls };
}

function severityRank(severity) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function prescreenJobPosting(jobText) {
  const normalizedJob = normalizeWhitespace(jobText);
  if (!normalizedJob) {
    return {
      checked: false,
      risk: "none",
      flags: [],
    };
  }

  const flags = JOB_POSTING_SAFETY_RULES.flatMap((rule) => {
    const match = normalizedJob.match(rule.pattern);
    if (!match) return [];
    return [{
      type: rule.type,
      severity: rule.severity,
      message: rule.message,
      matchedText: match[0],
    }];
  });
  const highestSeverity = flags.reduce((highest, flag) =>
    severityRank(flag.severity) > severityRank(highest) ? flag.severity : highest,
  "low");

  return {
    checked: true,
    risk: highestSeverity,
    flags,
  };
}

function hasQuantifiedImpact(line) {
  const amount = "\\d[\\d,]*(?:\\.\\d+)?";
  const scaleUnit = "(?:percent|times|k|m|mm|b)";
  // Outcome/scale units count as impact: audience reach, effort/duration, and money/outcome
  // metrics. Bare counts of generic work-items (projects, tickets, requests, applications,
  // deployments, teams) are not treated as quantified impact on their own to avoid
  // "3 projects"-style false positives that read like list labels rather than measured results.
  const impactUnit = "(?:users?|customers?|people|hours?|days?|weeks?|months?|years?|revenue|costs?|savings?)";
  const quantifiedImpact = new RegExp(
    `(?:[$€£]\\s*)?\\b${amount}\\s*(?:(?:%|x)|(?:${scaleUnit}|${impactUnit})\\b)|[$€£]\\s*${amount}\\b`,
    "i"
  );
  return quantifiedImpact.test(line);
}

function cleanBulletText(line) {
  return String(line || "").replace(/^[-*•]\s+/, "").trim();
}

function startsWithActionVerb(line) {
  const firstWord = cleanBulletText(line).split(/\s+/)[0]?.toLowerCase();
  return ACTION_VERBS.includes(firstWord);
}

function sentenceCase(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

function buildSuggestedEditText({ bullet, issueType, fillerPhrase }) {
  const body = cleanBulletText(bullet).replace(/[.。]+$/, "");
  if (fillerPhrase) {
    // Deterministic tooling should not silently rewrite prose into a noun
    // phrase (that produced broken sentences like "analysts specific
    // contribution providing..."). Instead, mark the filler in place as an
    // explicit human edit point and leave the surrounding claim untouched.
    const flagged = normalizeWhitespace(
      body.replace(new RegExp(fillerPhrase, "ig"), `[rephrase: ${fillerPhrase} ->]`),
    );
    return `- ${sentenceCase(flagged)}; replace the marked filler with a concrete, truthful action and add scope/result if available.`;
  }
  if (issueType === "weak-opener") {
    return `- [Action verb] ${body}; add truthful scope/result if available.`;
  }
  if (issueType === "missing-quantified-impact") {
    return `- ${body}; add truthful metric for scale, frequency, time, cost, quality, users, or outcome if available.`;
  }
  return `- ${body}`;
}

function buildSuggestedEditDiff({ before, suggested }) {
  return [
    { op: "remove", text: before },
    { op: "add", text: suggested },
  ];
}

function buildSuggestedEdits({ bullets }) {
  const items = [];
  const seen = new Set();

  function addEdit({ bullet, issueType, why, evidenceRequired, fillerPhrase = null }) {
    const key = `${issueType}:${bullet}`;
    if (seen.has(key) || items.length >= 6) return;
    seen.add(key);
    const suggested = buildSuggestedEditText({ bullet, issueType, fillerPhrase });
    items.push({
      type: issueType,
      before: bullet,
      suggested,
      diff: buildSuggestedEditDiff({ before: bullet, suggested }),
      why,
      evidenceRequired,
    });
  }

  for (const bullet of bullets) {
    const lower = bullet.toLowerCase();
    const fillerPhrase = FILLER_PHRASES.find((phrase) => lower.includes(phrase));
    if (!fillerPhrase) continue;
    addEdit({
      bullet,
      issueType: "replace-filler",
      fillerPhrase,
      why: `Filler phrase "${fillerPhrase}" is generic and should be replaced with specific work evidence.`,
      evidenceRequired: [
        "What specific contribution, responsibility, project, or outcome does this phrase refer to?",
        "Can you support it with truthful scope, frequency, stakeholders, or result?",
      ],
    });
  }

  for (const bullet of bullets) {
    if (startsWithActionVerb(bullet)) continue;
    addEdit({
      bullet,
      issueType: "weak-opener",
      why: "The bullet does not start with a recognized action verb, so the contribution may be harder to scan.",
      evidenceRequired: [
        "Which action did you personally take: built, led, improved, shipped, reduced, migrated, supported, or similar?",
        "Keep the original claim truthful; do not add responsibilities that are not in your source resume or notes.",
      ],
    });
  }

  for (const bullet of bullets) {
    if (hasQuantifiedImpact(bullet)) continue;
    addEdit({
      bullet,
      issueType: "missing-quantified-impact",
      why: "The bullet has no deterministic numeric evidence for scale, effort, or outcome.",
      evidenceRequired: [
        "Is there a truthful number for users, volume, time saved, cost, revenue, reliability, frequency, team size, or duration?",
        "If no metric exists, keep the bullet qualitative rather than inventing a number.",
      ],
    });
  }

  return {
    checked: bullets.length > 0,
    items,
  };
}

function findMissingKeywords(resumeText, jobText, limit = 12) {
  if (!normalizeWhitespace(jobText)) return [];
  const resumeTokens = new Set(tokenizeKeywords(resumeText).map((entry) => entry.keyword));
  return topKeywords(jobText, 30)
    .filter((entry) => !resumeTokens.has(entry.keyword))
    .slice(0, limit);
}

function extractUserNotesContext(resumeText, notesText) {
  const normalizedNotes = normalizeWhitespace(notesText);
  if (!normalizedNotes) {
    return {
      checked: false,
      keywords: [],
      missingResumeKeywords: [],
    };
  }

  return {
    checked: true,
    keywords: topKeywords(normalizedNotes, 12),
    missingResumeKeywords: findMissingKeywords(resumeText, normalizedNotes, 8),
  };
}

function compactKeyword(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+#]+/g, "");
}

function textMatchesKeyword(text, keyword) {
  const normalizedText = normalizeWhitespace(text).toLowerCase();
  const normalizedKeyword = normalizeWhitespace(keyword).toLowerCase();
  if (!normalizedKeyword) return false;
  if (normalizedText.includes(normalizedKeyword)) return true;

  const textTokens = new Set(tokenizeKeywords(normalizedText).map((entry) => entry.keyword));
  if (textTokens.has(normalizedKeyword)) return true;
  const normalizedNeedle = normalizeSkillTerm(normalizedKeyword);
  if (normalizedNeedle && textTokens.has(normalizedNeedle)) return true;

  const compactText = compactKeyword(normalizedText);
  const compactNeedle = compactKeyword(normalizedKeyword);
  if (compactNeedle.length >= 3 && compactText.includes(compactNeedle)) return true;
  const compactNormalizedNeedle = compactKeyword(normalizedNeedle);
  return compactNormalizedNeedle.length >= 3 && compactText.includes(compactNormalizedNeedle);
}

function buildEvidenceMap({ resumeText, bullets, jobPostingSignals }) {
  if (!jobPostingSignals.checked) {
    return {
      checked: false,
      hardRequirements: [],
    };
  }

  const resumeKeywords = tokenizeKeywords(resumeText);
  const hardRequirements = jobPostingSignals.hardRequirements.map((requirement) => {
    // Concept expansion: a requirement is satisfied by its own keyword OR by
    // any equivalent term from the curated skill lexicon. This only connects a
    // requirement to evidence the resume actually contains; it never invents a
    // skill. We track which term matched so the match stays explainable.
    const { concept, terms } = expandRequirementTerms(requirement.keyword);

    const matchedKeywordsSet = new Set();
    const matchedViaSet = new Set();
    for (const term of terms) {
      for (const entry of resumeKeywords) {
        if (textMatchesKeyword(entry.keyword, term)) {
          matchedKeywordsSet.add(entry.keyword);
          matchedViaSet.add(term);
        }
      }
    }

    const matchedBullets = [];
    for (const bullet of bullets) {
      const hitTerm = terms.find((term) => textMatchesKeyword(bullet, term));
      if (hitTerm) {
        matchedBullets.push(bullet);
        matchedViaSet.add(hitTerm);
      }
    }

    const matchedKeywords = [...matchedKeywordsSet];
    let status = "missing";
    if (matchedBullets.length > 0) status = "matched";
    else if (matchedKeywords.length > 0) status = "partial";

    // matchedVia excludes the literal requirement keyword itself when the match
    // came purely from a synonym, so reviewers can see the concept link.
    const literalRequirement = normalizeSkillTerm(requirement.keyword);
    const matchedVia = [...matchedViaSet].filter((term) =>
      normalizeSkillTerm(term) !== literalRequirement
    );

    return {
      keyword: requirement.keyword,
      concept,
      count: requirement.count,
      status,
      matchedKeywords,
      matchedBullets,
      matchedVia,
    };
  });

  return {
    checked: true,
    hardRequirements,
  };
}

function buildTailoringOpportunities({ evidenceMap, jobPostingSignals }) {
  if (!jobPostingSignals.checked) {
    return {
      checked: false,
      items: [],
    };
  }

  const items = [];
  for (const requirement of evidenceMap.hardRequirements.slice(0, 10)) {
    if (requirement.status === "matched") {
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "preserve-strength",
        recommendation: `Keep ${requirement.keyword} visible near the most relevant role or skills section.`,
        question: null,
      });
    } else if (requirement.status === "partial") {
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "strengthen-evidence",
        recommendation: `Resume keyword evidence exists for ${requirement.keyword}, but no matching bullet was found.`,
        question: `Do you have a truthful accomplishment, project, or responsibility that shows ${requirement.keyword} in action?`,
      });
    } else {
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "missing-evidence",
        recommendation: `No deterministic resume evidence was found for ${requirement.keyword}. Do not add it unless it reflects real experience.`,
        question: `Is ${requirement.keyword} a real skill, tool, or responsibility you can support with an example?`,
      });
    }
  }

  const existingRequirements = new Set(items.map((item) => item.requirement));
  for (const niceToHave of jobPostingSignals.niceToHaves) {
    if (items.length >= 12) break;
    if (existingRequirements.has(niceToHave.keyword)) continue;
    items.push({
      requirement: niceToHave.keyword,
      status: "optional",
      type: "nice-to-have",
      recommendation: `Consider mentioning ${niceToHave.keyword} only if it is already part of real experience or supporting notes.`,
      question: `Do you have truthful evidence for ${niceToHave.keyword} that would strengthen this application?`,
    });
  }

  return {
    checked: true,
    items,
  };
}

function buildJobFit({ evidenceMap, jobPostingSignals }) {
  if (!jobPostingSignals.checked || !evidenceMap.checked) {
    return {
      checked: false,
      score: null,
      band: "unknown",
      counts: { matched: 0, partial: 0, missing: 0, total: 0 },
      explanation: "No job posting supplied, so no job-fit score was computed.",
    };
  }

  const requirements = evidenceMap.hardRequirements;
  const total = requirements.length;
  if (total === 0) {
    return {
      checked: true,
      score: null,
      band: "unknown",
      counts: { matched: 0, partial: 0, missing: 0, total: 0 },
      explanation: "No hard requirements were detected in the posting, so job fit could not be scored deterministically.",
    };
  }

  const matched = requirements.filter((req) => req.status === "matched").length;
  const partial = requirements.filter((req) => req.status === "partial").length;
  const missing = requirements.filter((req) => req.status === "missing").length;
  // Matched bullet evidence counts full; partial keyword-only evidence counts half.
  const score = Math.max(0, Math.min(100, Math.round(((matched + partial * 0.5) / total) * 100)));

  let band = "low";
  if (score >= 75) band = "strong";
  else if (score >= 50) band = "moderate";
  else if (score >= 25) band = "emerging";

  const missingKeywords = requirements
    .filter((req) => req.status === "missing")
    .map((req) => req.keyword);
  const partialKeywords = requirements
    .filter((req) => req.status === "partial")
    .map((req) => req.keyword);

  const explanationParts = [
    `${matched} of ${total} hard requirements have direct resume bullet evidence`,
    `${partial} have keyword-only evidence`,
    `${missing} have no deterministic evidence`,
  ];
  let explanation = `${explanationParts.join(", ")}.`;
  if (partialKeywords.length > 0) {
    explanation += ` Strengthen real bullet evidence for: ${partialKeywords.join(", ")}.`;
  }
  if (missingKeywords.length > 0) {
    explanation += ` Confirm whether these reflect real experience before claiming them: ${missingKeywords.join(", ")}.`;
  }
  explanation += " This deterministic fit signal reflects keyword/bullet overlap only, not a hiring decision.";

  return {
    checked: true,
    score,
    band,
    counts: { matched, partial, missing, total },
    explanation,
  };
}

function buildInterviewTalkingPoints({ evidenceMap, jobPostingSignals }) {
  if (!jobPostingSignals.checked || !evidenceMap.checked) {
    return {
      checked: false,
      items: [],
    };
  }

  const items = [];
  for (const requirement of evidenceMap.hardRequirements.slice(0, 10)) {
    if (requirement.status === "matched") {
      const evidence = requirement.matchedBullets[0] || "";
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "strength-story",
        talkingPoint: `Be ready to walk through a concrete ${requirement.keyword} example from your resume.`,
        evidence,
        question: null,
      });
    } else if (requirement.status === "partial") {
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "clarify-evidence",
        talkingPoint: `Prepare a truthful, specific story that shows ${requirement.keyword} in action; the resume only lists it as a keyword.`,
        evidence: "",
        question: `What real accomplishment best demonstrates ${requirement.keyword}?`,
      });
    } else {
      items.push({
        requirement: requirement.keyword,
        status: requirement.status,
        type: "address-gap",
        talkingPoint: `Decide honestly how to address ${requirement.keyword} if asked; do not overstate experience you do not have.`,
        evidence: "",
        question: `Do you have transferable or adjacent experience for ${requirement.keyword} you can speak to truthfully?`,
      });
    }
  }

  return {
    checked: true,
    items,
  };
}

function safeRatio(numerator, denominator) {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(2));
}

function scoreResume({ sections, bullets, quantifiedBullets, actionVerbBullets, fillerHits, missingKeywords }) {
  if (sections.length === 0 && bullets.length === 0) return 0;
  let score = 45;
  score += Math.min(sections.length, 5) * 6;
  score += Math.min(bullets.length, 12) * 1.5;
  score += Math.min(quantifiedBullets.length, 8) * 3;
  score += Math.min(actionVerbBullets.length, 8) * 2;
  score -= fillerHits.length * 4;
  score -= Math.min(missingKeywords.length, 8) * 2;
  if (bullets.length > 30) score -= Math.min(10, Math.ceil((bullets.length - 30) / 4));
  if (bullets.length >= 12 && safeRatio(quantifiedBullets.length, bullets.length) < 0.15) score -= 8;
  if (bullets.length >= 12 && safeRatio(actionVerbBullets.length, bullets.length) < 0.2) score -= 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildIssues({ lines, sections, bullets, quantifiedBullets, actionVerbBullets, fillerHits, missingKeywords }) {
  const issues = [];
  const missingCoreSections = Object.entries(CORE_SECTION_ALIASES)
    .filter(([, aliases]) => !sections.some((found) => aliases.includes(found)))
    .map(([section]) => section);

  if (lines.length === 0) {
    issues.push({
      severity: "high",
      area: "input",
      message: "Resume input is empty.",
      recommendation: "Provide the current resume text or a plain-text export before running review.",
    });
    return issues;
  }

  for (const section of missingCoreSections) {
    issues.push({
      severity: "medium",
      area: "structure",
      message: `Missing obvious ${section} section.`,
      recommendation: `Add a clear ${section} heading so humans and ATS parsers can scan the resume quickly.`,
    });
  }

  if (bullets.length < 4) {
    issues.push({
      severity: "medium",
      area: "readability",
      message: "Few achievement bullets detected.",
      recommendation: "Use concise bullets under recent roles so accomplishments are easy to scan.",
    });
  }

  if (bullets.length > 30) {
    issues.push({
      severity: "medium",
      area: "readability",
      message: `Very dense resume detected: ${bullets.length} bullets.`,
      recommendation: "Condense older or lower-impact bullets so the strongest recent evidence is easier to scan.",
    });
  }

  if (quantifiedBullets.length < Math.min(3, bullets.length)) {
    issues.push({
      severity: "medium",
      area: "evidence",
      message: "Limited quantified impact detected.",
      recommendation: "Add truthful numbers for scale, frequency, cost, time saved, revenue, reliability, or team size where available.",
    });
  }

  if (bullets.length >= 12 && safeRatio(quantifiedBullets.length, bullets.length) < 0.15) {
    issues.push({
      severity: "medium",
      area: "evidence",
      message: `Low quantified-impact ratio: ${quantifiedBullets.length}/${bullets.length} bullets include numeric evidence.`,
      recommendation: "Prioritize adding truthful metrics to the most role-relevant bullets before adding more bullets.",
    });
  }

  if (actionVerbBullets.length < Math.min(3, bullets.length)) {
    issues.push({
      severity: "low",
      area: "wording",
      message: "Some bullets may start weakly.",
      recommendation: "Start important bullets with concrete action verbs like built, led, improved, shipped, reduced, or migrated.",
    });
  }

  if (bullets.length >= 12 && safeRatio(actionVerbBullets.length, bullets.length) < 0.2) {
    issues.push({
      severity: "low",
      area: "wording",
      message: `Low action-verb ratio: ${actionVerbBullets.length}/${bullets.length} bullets start with recognized action verbs.`,
      recommendation: "Rewrite the highest-value bullets to start with concrete verbs and outcomes.",
    });
  }

  for (const phrase of fillerHits) {
    issues.push({
      severity: "low",
      area: "wording",
      message: `Filler phrase detected: ${phrase}.`,
      recommendation: "Replace generic traits with specific evidence from work, projects, or outcomes.",
    });
  }

  if (missingKeywords.length > 0) {
    issues.push({
      severity: "medium",
      area: "job-match",
      message: `Job posting terms not found in resume: ${missingKeywords.map((entry) => entry.keyword).join(", ")}.`,
      recommendation: "Only add missing terms when they truthfully describe real experience or relevant projects.",
    });
  }

  return issues;
}

// Deterministic, template-only prioritization of the highest-signal findings.
// Pulls from already-computed structures; generates no free-form prose beyond fixed templates.
// Stable ordering by category priority, then severity, then source order, capped at 5.
function buildTopFindings({ issues, jobPostingSafety, evidenceMap, missingKeywords, userNotes }) {
  const findings = [];
  const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

  // 1. Safety flags from a pasted job posting are the highest priority.
  if (jobPostingSafety?.checked && Array.isArray(jobPostingSafety.flags)) {
    for (const flag of jobPostingSafety.flags) {
      findings.push({
        priority: 0,
        severity: flag.severity || "high",
        category: "safety",
        message: `Job posting safety flag (${flag.type}): ${flag.message}`,
      });
    }
  }

  // 2. High-severity resume issues.
  for (const issue of issues) {
    if (issue.severity === "high") {
      findings.push({
        priority: 1,
        severity: "high",
        category: issue.area,
        message: issue.message,
      });
    }
  }

  // 3. Unmet hard requirements from the evidence map (job-match gaps).
  if (evidenceMap?.checked && Array.isArray(evidenceMap.hardRequirements)) {
    const missingReqs = evidenceMap.hardRequirements.filter((req) => req.status === "missing");
    if (missingReqs.length > 0) {
      findings.push({
        priority: 2,
        severity: "medium",
        category: "job-match",
        message: `Hard requirements with no resume evidence: ${missingReqs.map((req) => req.keyword).join(", ")}.`,
      });
    }
  } else if (missingKeywords.length > 0) {
    // Fall back to plain missing-keyword signal when no evidence map is available.
    findings.push({
      priority: 2,
      severity: "medium",
      category: "job-match",
      message: `Job posting terms not found in resume: ${missingKeywords.map((entry) => entry.keyword).join(", ")}.`,
    });
  }

  // 4. Medium-severity resume issues (density, evidence ratios, structure).
  for (const issue of issues) {
    if (issue.severity === "medium" && issue.area !== "job-match") {
      findings.push({
        priority: 3,
        severity: "medium",
        category: issue.area,
        message: issue.message,
      });
    }
  }

  // 5. Notes target-context gaps.
  if (userNotes?.checked && Array.isArray(userNotes.missingResumeKeywords) && userNotes.missingResumeKeywords.length > 0) {
    findings.push({
      priority: 4,
      severity: "low",
      category: "notes",
      message: `Target/notes terms not yet visible in resume: ${userNotes.missingResumeKeywords.map((entry) => entry.keyword).join(", ")}.`,
    });
  }

  // 6. Low-severity resume issues, last.
  for (const issue of issues) {
    if (issue.severity === "low") {
      findings.push({
        priority: 5,
        severity: "low",
        category: issue.area,
        message: issue.message,
      });
    }
  }

  // Stable sort by priority, then severity, preserving insertion order otherwise.
  const ordered = findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      if (a.finding.priority !== b.finding.priority) return a.finding.priority - b.finding.priority;
      const sevA = SEVERITY_RANK[a.finding.severity] ?? 3;
      const sevB = SEVERITY_RANK[b.finding.severity] ?? 3;
      if (sevA !== sevB) return sevA - sevB;
      return a.index - b.index;
    })
    .map(({ finding }) => ({ severity: finding.severity, category: finding.category, message: finding.message }));

  return ordered.slice(0, 5);
}

function buildChecklist({ jobText, jobPostingSafety, userNotes }) {
  const checklist = [
    "Confirm every suggested edit is truthful and backed by real experience.",
    "Prefer accomplishment bullets with action, scope, and result.",
    "Keep formatting simple: clear headings, consistent dates, and readable bullets.",
    "Save a reviewed copy before sending it to an employer.",
  ];
  if (normalizeWhitespace(jobText)) {
    checklist.splice(1, 0, "Map resume claims to the target posting without inventing skills, dates, employers, or credentials.");
  }
  if (jobPostingSafety?.flags?.length > 0) {
    checklist.splice(1, 0, "Review job-posting safety flags before using job-specific recommendations.");
  }
  if (userNotes?.checked) {
    checklist.splice(1, 0, "Treat user notes as target context or constraints, not as resume claims by themselves.");
  }
  return checklist;
}

function buildFinalDraftChecklist({ jobText, jobPostingSafety, userNotes }) {
  const items = [
    {
      category: "truthfulness",
      required: true,
      item: "Every content change is backed by source resume evidence, user-confirmed notes, or a clearly marked question.",
    },
    {
      category: "claims",
      required: true,
      item: "No unsupported metrics, tools, titles, employers, dates, credentials, locations, or work authorization claims were added.",
    },
    {
      category: "formatting",
      required: true,
      item: "Headings, dates, bullets, tense, and punctuation are consistent enough for human and ATS scanning.",
    },
    {
      category: "privacy",
      required: true,
      item: "Private drafts, source files, and run outputs are kept out of git and shared locations unless explicitly sanitized.",
    },
  ];

  if (normalizeWhitespace(jobText)) {
    items.splice(2, 0, {
      category: "job-match",
      required: true,
      item: "Each job-specific edit maps to real resume evidence or is left as a user question instead of a claim.",
    });
  }
  if (jobPostingSafety?.flags?.length > 0) {
    items.splice(0, 0, {
      category: "safety",
      required: true,
      item: "Job-posting safety flags were reviewed before using any job-specific recommendation.",
    });
  }
  if (userNotes?.checked) {
    items.splice(2, 0, {
      category: "notes",
      required: true,
      item: "User notes were checked as context only and not treated as resume evidence by themselves.",
    });
  }

  return {
    checked: true,
    items,
  };
}

export function reviewResume({ resumeText, jobText = "", notesText = "" }) {
  const normalizedResume = normalizeWhitespace(resumeText);
  const normalizedJob = normalizeWhitespace(jobText);
  const normalizedNotes = normalizeWhitespace(notesText);
  const jobPostingSafety = prescreenJobPosting(normalizedJob);
  const jobPostingSignals = extractJobPostingSignals(normalizedJob);
  const jobPostingSources = extractJobPostingSources(normalizedJob);
  const userNotes = extractUserNotesContext(normalizedResume, normalizedNotes);
  const lines = splitLines(normalizedResume);
  const sections = detectSections(lines);
  const bullets = bulletLines(lines);
  const quantifiedBullets = bullets.filter(hasQuantifiedImpact);
  const actionVerbBullets = bullets.filter(startsWithActionVerb);
  const fillerHits = FILLER_PHRASES.filter((phrase) => normalizedResume.toLowerCase().includes(phrase));
  const suggestedEdits = buildSuggestedEdits({ bullets });
  const missingKeywords = findMissingKeywords(normalizedResume, normalizedJob);
  const evidenceMap = buildEvidenceMap({
    resumeText: normalizedResume,
    bullets,
    jobPostingSignals,
  });
  const tailoringOpportunities = buildTailoringOpportunities({
    evidenceMap,
    jobPostingSignals,
  });
  const jobFit = buildJobFit({
    evidenceMap,
    jobPostingSignals,
  });
  const interviewTalkingPoints = buildInterviewTalkingPoints({
    evidenceMap,
    jobPostingSignals,
  });
  const issues = buildIssues({
    lines,
    sections,
    bullets,
    quantifiedBullets,
    actionVerbBullets,
    fillerHits,
    missingKeywords,
  });
  const score = scoreResume({
    sections,
    bullets,
    quantifiedBullets,
    actionVerbBullets,
    fillerHits,
    missingKeywords,
  });
  const topFindings = buildTopFindings({
    issues,
    jobPostingSafety,
    evidenceMap,
    missingKeywords,
    userNotes,
  });

  return {
    schema: "recruiter-agent.resume-review.v0",
    generatedAt: new Date().toISOString(),
    score,
    topFindings,
    summary: {
      lineCount: lines.length,
      sectionCount: sections.length,
      bulletCount: bullets.length,
      quantifiedBulletCount: quantifiedBullets.length,
      quantifiedBulletRatio: safeRatio(quantifiedBullets.length, bullets.length),
      actionVerbBulletCount: actionVerbBullets.length,
      actionVerbBulletRatio: safeRatio(actionVerbBullets.length, bullets.length),
      jobPostingCompared: normalizedJob.length > 0,
      userNotesCompared: normalizedNotes.length > 0,
    },
    sections,
    userNotes,
    jobPostingSafety,
    jobPostingSignals,
    jobPostingSources,
    evidenceMap,
    jobFit,
    tailoringOpportunities,
    interviewTalkingPoints,
    suggestedEdits,
    topResumeKeywords: topKeywords(normalizedResume, 12),
    missingJobKeywords: missingKeywords,
    issues,
    checklist: buildChecklist({ jobText: normalizedJob, jobPostingSafety, userNotes }),
    finalDraftChecklist: buildFinalDraftChecklist({ jobText: normalizedJob, jobPostingSafety, userNotes }),
  };
}

export function formatReviewText(review) {
  const fitLine = review.jobFit?.checked && review.jobFit.score !== null
    ? `Job Fit: ${review.jobFit.score}/100 (${review.jobFit.band})`
    : `Job Fit: not scored (${review.jobFit?.checked ? "no hard requirements detected" : "no job posting supplied"})`;
  const lines = [
    "Recruiter Agent Resume Review",
    `Score: ${review.score}/100`,
    fitLine,
    "",
    "Top Findings",
  ];

  if (!review.topFindings || review.topFindings.length === 0) {
    lines.push("- No high-priority findings from the deterministic checks.");
  } else {
    let rank = 1;
    for (const finding of review.topFindings) {
      lines.push(`${rank}. [${finding.severity}] ${finding.category}: ${finding.message}`);
      rank += 1;
    }
  }

  lines.push(
    "",
    "Summary",
    `- Lines: ${review.summary.lineCount}`,
    `- Sections detected: ${review.sections.length > 0 ? review.sections.join(", ") : "none"}`,
    `- Bullets: ${review.summary.bulletCount}`,
    `- Quantified bullets: ${review.summary.quantifiedBulletCount} (${Math.round((review.summary.quantifiedBulletRatio || 0) * 100)}%)`,
    `- Action-verb bullets: ${review.summary.actionVerbBulletCount} (${Math.round((review.summary.actionVerbBulletRatio || 0) * 100)}%)`,
    `- Job posting compared: ${review.summary.jobPostingCompared ? "yes" : "no"}`,
    `- User notes compared: ${review.summary.userNotesCompared ? "yes" : "no"}`,
    "",
    "User Notes Context",
  );

  if (!review.userNotes?.checked) {
    lines.push("- Not checked: no notes file supplied.");
  } else {
    lines.push(`- Notes keywords: ${review.userNotes.keywords.map((entry) => entry.keyword).join(", ") || "none detected"}`);
    if (review.userNotes.missingResumeKeywords.length > 0) {
      lines.push(`- Notes terms not found in resume: ${review.userNotes.missingResumeKeywords.map((entry) => entry.keyword).join(", ")}`);
    } else {
      lines.push("- Notes terms are already visible in resume keywords.");
    }
    lines.push("- Notes are context only; do not treat them as resume evidence without source support.");
  }

  lines.push(
    "",
    "Job Posting Safety",
  );

  if (!review.jobPostingSafety.checked) {
    lines.push("- Not checked: no job posting supplied.");
  } else if (review.jobPostingSafety.flags.length === 0) {
    lines.push("- No suspicious posting instructions detected by deterministic checks.");
  } else {
    lines.push(`- Risk: ${review.jobPostingSafety.risk}`);
    for (const flag of review.jobPostingSafety.flags) {
      lines.push(`- [${flag.severity}] ${flag.type}: ${flag.message}`);
    }
  }

  lines.push("", "Job Posting Signals");
  if (!review.jobPostingSignals.checked) {
    lines.push("- Not extracted: no job posting supplied.");
  } else {
    lines.push(`- Requirements: ${review.jobPostingSignals.hardRequirements.map((entry) => entry.keyword).join(", ") || "none detected"}`);
    lines.push(`- Nice-to-haves: ${review.jobPostingSignals.niceToHaves.map((entry) => entry.keyword).join(", ") || "none detected"}`);
    lines.push(`- Seniority: ${review.jobPostingSignals.senioritySignals.join(", ") || "none detected"}`);
    lines.push(`- Domain keywords: ${review.jobPostingSignals.domainKeywords.map((entry) => entry.keyword).join(", ") || "none detected"}`);
  }

  lines.push("", "Job Posting Sources");
  if (!review.jobPostingSources?.checked) {
    lines.push("- Not labeled: no job posting supplied.");
  } else if (review.jobPostingSources.urls.length === 0) {
    lines.push("- No URLs found in the job posting.");
  } else {
    for (const source of review.jobPostingSources.urls) {
      lines.push(`- [${source.label}] ${source.url}`);
      lines.push(`  ${source.reason}`);
    }
  }

  lines.push("", "Requirement Evidence");
  if (!review.evidenceMap?.checked) {
    lines.push("- Not mapped: no job posting supplied.");
  } else if (review.evidenceMap.hardRequirements.length === 0) {
    lines.push("- No hard requirements detected to map.");
  } else {
    for (const requirement of review.evidenceMap.hardRequirements) {
      const conceptTag = requirement.concept && requirement.concept !== requirement.keyword
        ? ` (concept: ${requirement.concept})`
        : "";
      lines.push(`- [${requirement.status}] ${requirement.keyword}${conceptTag}`);
      if (requirement.matchedVia && requirement.matchedVia.length > 0) {
        lines.push(`  Matched via: ${requirement.matchedVia.join(", ")}`);
      }
      if (requirement.matchedBullets.length > 0) {
        for (const bullet of requirement.matchedBullets) lines.push(`  Evidence: ${bullet}`);
      } else if (requirement.matchedKeywords.length > 0) {
        lines.push(`  Resume keyword evidence: ${requirement.matchedKeywords.join(", ")}`);
      } else {
        lines.push("  Evidence: none found in resume.");
      }
    }
  }

  lines.push("", "Truthful Tailoring Opportunities");
  if (!review.tailoringOpportunities?.checked) {
    lines.push("- Not generated: no job posting supplied.");
  } else if (review.tailoringOpportunities.items.length === 0) {
    lines.push("- No deterministic tailoring opportunities detected.");
  } else {
    for (const item of review.tailoringOpportunities.items) {
      lines.push(`- [${item.type}] ${item.requirement}: ${item.recommendation}`);
      if (item.question) lines.push(`  Question: ${item.question}`);
    }
  }

  lines.push("", "Job Fit");
  if (!review.jobFit?.checked) {
    lines.push("- Not scored: no job posting supplied.");
  } else if (review.jobFit.score === null) {
    lines.push(`- Not scored: ${review.jobFit.explanation}`);
  } else {
    lines.push(`- Fit score: ${review.jobFit.score}/100 (${review.jobFit.band})`);
    lines.push(`- Requirements matched/partial/missing: ${review.jobFit.counts.matched}/${review.jobFit.counts.partial}/${review.jobFit.counts.missing} of ${review.jobFit.counts.total}`);
    lines.push(`- Explanation: ${review.jobFit.explanation}`);
  }

  lines.push("", "Interview Talking Points");
  if (!review.interviewTalkingPoints?.checked) {
    lines.push("- Not generated: no job posting supplied.");
  } else if (review.interviewTalkingPoints.items.length === 0) {
    lines.push("- No deterministic talking points detected.");
  } else {
    for (const item of review.interviewTalkingPoints.items) {
      lines.push(`- [${item.type}] ${item.requirement}: ${item.talkingPoint}`);
      if (item.evidence) lines.push(`  Evidence: ${item.evidence}`);
      if (item.question) lines.push(`  Question: ${item.question}`);
    }
  }

  lines.push(
    "",
    "Issues",
  );

  if (review.issues.length === 0) {
    lines.push("- No major issues detected by the deterministic MVP checks.");
  } else {
    for (const issue of review.issues) {
      lines.push(`- [${issue.severity}] ${issue.area}: ${issue.message}`);
      lines.push(`  Recommendation: ${issue.recommendation}`);
    }
  }

  lines.push("", "Suggested Edits");
  if (!review.suggestedEdits?.checked) {
    lines.push("- Not generated: no resume bullets detected.");
  } else if (review.suggestedEdits.items.length === 0) {
    lines.push("- No deterministic bullet-level edits suggested.");
  } else {
    for (const edit of review.suggestedEdits.items) {
      lines.push(`- [${edit.type}]`);
      lines.push(`  Before: ${edit.before}`);
      lines.push(`  Suggested: ${edit.suggested}`);
      if (Array.isArray(edit.diff) && edit.diff.length > 0) {
        lines.push("  Diff:");
        for (const line of edit.diff) {
          const prefix = line.op === "add" ? "+" : line.op === "remove" ? "-" : " ";
          lines.push(`    ${prefix} ${line.text}`);
        }
      }
      lines.push(`  Why: ${edit.why}`);
      lines.push(`  Evidence required: ${edit.evidenceRequired.join(" ")}`);
    }
  }

  lines.push("", "Final Draft Acceptance Checklist");
  if (review.finalDraftChecklist?.items?.length > 0) {
    for (const item of review.finalDraftChecklist.items) {
      const required = item.required ? "required" : "optional";
      lines.push(`- [${required}] ${item.category}: ${item.item}`);
    }
  } else {
    for (const item of review.checklist) lines.push(`- ${item}`);
  }

  if (review.missingJobKeywords.length > 0) {
    lines.push("", "Missing Job Keywords");
    for (const entry of review.missingJobKeywords) lines.push(`- ${entry.keyword} (${entry.count})`);
  }

  if (review.run?.inputs) {
    lines.push("", "Run Metadata");
    lines.push(`- Resume source: ${review.run.inputs.resume.fileName}`);
    lines.push(`- Resume SHA-256: ${review.run.inputs.resume.sha256}`);
    if (review.run.inputs.job) {
      lines.push(`- Job source: ${review.run.inputs.job.fileName}`);
      lines.push(`- Job SHA-256: ${review.run.inputs.job.sha256}`);
    }
    if (review.run.inputs.notes) {
      lines.push(`- Notes source: ${review.run.inputs.notes.fileName}`);
      lines.push(`- Notes SHA-256: ${review.run.inputs.notes.sha256}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
