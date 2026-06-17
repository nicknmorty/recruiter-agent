// Track B citation layer (deterministic, fabrication-resistant).
//
// The offline core never invents company, compensation, review, or role facts.
// External findings only become "cited" when a reviewer attaches real, dated,
// source-labeled citations. This module validates and merges those citations
// into a research packet. It performs no network calls itself: gathering
// citations is a separate, clearly-marked human/model+web step. Acceptance here
// is deterministic and auditable so an unsupported claim can never silently
// turn into a verified one.

const SHORTENER_HOSTS = new Set([
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "lnkd.in",
  "rebrand.ly", "cutt.ly", "is.gd", "shorturl.at",
]);

const JOB_BOARD_HOSTS = new Set([
  "indeed.com", "linkedin.com", "glassdoor.com", "ziprecruiter.com",
  "monster.com", "dice.com", "lever.co", "greenhouse.io", "workday.com",
  "myworkdayjobs.com", "ashbyhq.com", "smartrecruiters.com", "jobvite.com",
  "icims.com", "bamboohr.com", "workable.com", "taleo.net",
]);

const TRACKING_PARAM = /[?&](utm_[a-z]+|gclid|fbclid|mc_eid|igshid)=/i;

// Source types a reviewer may assert, in rough trust order. The first-party /
// direct-employer types are strongest for company facts.
export const CITATION_SOURCE_TYPES = [
  "direct_employer",
  "official_filing",
  "reputable_press",
  "job_board",
  "review_site",
  "compensation_aggregator",
  "other",
];

export const CITATION_CONFIDENCE = ["high", "medium", "low"];

const TOPIC_CLAIMS = {
  role: [
    "Current role expectations",
    "Common required skills",
    "Market differentiators",
  ],
  company: [
    "Company context",
    "Hiring team or product context",
    "Application workflow or posting freshness",
  ],
  compensation: [
    "Compensation range",
    "Geography or remote-work assumptions",
    "Seniority and employment-type assumptions",
  ],
  workflow: [
    "Application workflow steps",
    "Required application artifacts",
    "Follow-up timing",
  ],
  application: [
    "Truthful application angle",
    "Cover-letter or interview emphasis",
    "Evidence question to ask before tailoring",
  ],
};

function rootDomain(host) {
  const parts = String(host || "").split(".");
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

// Deterministic URL label, mirroring the posting-source labeling used elsewhere
// in the project so all source quality judgments stay consistent.
export function labelUrl(rawUrl) {
  const url = String(rawUrl || "").trim().replace(/[.,;:]+$/, "");
  if (!url) return { url: "", host: null, label: "unknown", reason: "Empty URL." };
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { url, host: null, label: "unknown", reason: "URL could not be parsed." };
  }
  const root = rootDomain(host);
  const looksLikeDomain = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host) && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  if (SHORTENER_HOSTS.has(host) || SHORTENER_HOSTS.has(root) || TRACKING_PARAM.test(url)) {
    return { url, host, label: "tracking_or_shortener", reason: "Shortened or tracking link; true destination not visible." };
  }
  if (JOB_BOARD_HOSTS.has(host) || JOB_BOARD_HOSTS.has(root)) {
    return { url, host, label: "job_board", reason: "Recognized third-party job board or ATS host." };
  }
  if (looksLikeDomain) {
    return { url, host, label: "direct_company_domain", reason: "Not a known board or shortener; likely a direct company domain." };
  }
  return { url, host, label: "unknown", reason: "Host could not be classified." };
}

function isIsoDate(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const parsed = new Date(text);
  return !Number.isNaN(parsed.getTime());
}

// Validate a single citation record. Returns { ok, citation, errors }.
// A citation is rejected (never fabricated into a finding) when it lacks a
// parseable URL, a parseable accessedAt date, a claim, or a value.
export function validateCitation(input = {}) {
  const errors = [];
  const claim = String(input.claim ?? "").trim();
  const value = String(input.value ?? "").trim();
  const url = String(input.url ?? "").trim();
  const accessedAt = String(input.accessedAt ?? "").trim();
  const sourceType = String(input.sourceType ?? "").trim() || "other";
  const confidence = String(input.confidence ?? "").trim() || "medium";
  const quote = String(input.quote ?? "").trim();

  if (!claim) errors.push("missing claim");
  if (!value) errors.push("missing value");
  if (!url) errors.push("missing url");
  if (!accessedAt) errors.push("missing accessedAt date");
  else if (!isIsoDate(accessedAt)) errors.push(`unparseable accessedAt date: ${accessedAt}`);
  if (!CITATION_SOURCE_TYPES.includes(sourceType)) errors.push(`unknown sourceType: ${sourceType}`);
  if (!CITATION_CONFIDENCE.includes(confidence)) errors.push(`unknown confidence: ${confidence}`);

  const labeled = labelUrl(url);
  if (url && labeled.label === "unknown") errors.push(`url did not classify to a usable source: ${url}`);
  if (url && labeled.label === "tracking_or_shortener") errors.push(`url is a tracking/shortener link; resolve to the real destination first: ${url}`);

  if (errors.length) return { ok: false, citation: null, errors };

  return {
    ok: true,
    errors: [],
    citation: {
      claim,
      value,
      url: labeled.url,
      urlLabel: labeled.label,
      host: labeled.host,
      sourceType,
      confidence,
      accessedAt: new Date(accessedAt).toISOString(),
      quote: quote || null,
    },
  };
}

// Merge reviewed citations into a research packet, producing a citedFindings
// section and flipping the packet's external_research source-checklist entry to
// reflect that real sources are now attached. Invalid citations are collected
// in rejected[] and never become findings.
export function attachCitations(packet, citations = [], { now = new Date() } = {}) {
  const accepted = [];
  const rejected = [];
  for (const raw of citations) {
    const result = validateCitation(raw);
    if (result.ok) accepted.push(result.citation);
    else rejected.push({ input: raw, errors: result.errors });
  }

  // Group accepted citations by claim so a finding can carry corroboration.
  const byClaim = new Map();
  for (const c of accepted) {
    if (!byClaim.has(c.claim)) byClaim.set(c.claim, []);
    byClaim.get(c.claim).push(c);
  }

  const citedFindings = [...byClaim.entries()].map(([claim, sources]) => {
    const directBacked = sources.some((s) => s.sourceType === "direct_employer" || s.urlLabel === "direct_company_domain");
    const corroborated = sources.length >= 2;
    return {
      claim,
      status: "cited",
      value: sources[0].value,
      uncertainty: directBacked && corroborated ? "low" : corroborated ? "medium" : "medium",
      sources: sources.map((s) => ({
        value: s.value,
        url: s.url,
        urlLabel: s.urlLabel,
        sourceType: s.sourceType,
        confidence: s.confidence,
        accessedAt: s.accessedAt,
        quote: s.quote,
      })),
      note: corroborated ? "Corroborated by multiple sources." : "Single source; corroborate before relying on it.",
    };
  });

  const updatedChecklist = (packet.sourceChecklist || []).map((item) => {
    if (item.type !== "external_research") return item;
    return {
      ...item,
      status: accepted.length ? "sources_attached" : item.status,
      sources: accepted.map((c) => ({ url: c.url, label: c.urlLabel, sourceType: c.sourceType, accessedAt: c.accessedAt })),
      guidance: accepted.length
        ? "External claims below are backed by attached dated sources. Anything not listed remains needs_research."
        : item.guidance,
    };
  });

  return {
    ...packet,
    generatedAt: packet.generatedAt,
    citedAt: now.toISOString(),
    sourceChecklist: updatedChecklist,
    citedFindings,
    citationSummary: {
      accepted: accepted.length,
      rejected: rejected.length,
      distinctClaims: byClaim.size,
    },
    rejectedCitations: rejected,
    risksAndCaveats: [
      ...(packet.risksAndCaveats || []),
      accepted.length
        ? "Cited findings reflect only the attached sources; verify dates and destinations before relying on them."
        : "No valid citations were attached; all external claims remain needs_research.",
      rejected.length ? `${rejected.length} citation(s) were rejected and excluded; see rejectedCitations.` : null,
    ].filter(Boolean),
  };
}

function candidateClaims(packet) {
  const claims = new Set(TOPIC_CLAIMS[packet.topic] || TOPIC_CLAIMS.role);
  for (const question of packet.researchBrief?.researchQuestions || []) {
    claims.add(question.replace(/[?]+$/, ""));
  }
  for (const finding of packet.findings || []) {
    if (finding.status === "needs_research") claims.add(finding.claim);
  }
  return [...claims].slice(0, 8);
}

export function normalizeCitationInput(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.citations)) return input.citations;
  throw new Error("Citations file must be a JSON array, or an object with a citations array.");
}

export function buildCitationTemplate(packet, { now = new Date() } = {}) {
  return {
    schema: "recruiter-agent.citation-template.v1",
    generatedAt: now.toISOString(),
    packetGeneratedAt: packet.generatedAt,
    topic: packet.topic,
    topicLabel: packet.topicLabel,
    roleTitle: packet.roleTitle,
    instructions: [
      "Fill citations with dated public sources gathered by a human or model+web research pass.",
      "Use direct employer or official sources first; avoid shorteners, tracking links, gated pages, and unsupported claims.",
      "Do not upload resumes, apply to jobs, message recruiters, send email, or treat research as resume evidence.",
      "Pass this file back to `recruiter-agent research --job <path> --citations <file.json>`; only citations[] is validated.",
    ],
    allowedSourceTypes: CITATION_SOURCE_TYPES,
    allowedConfidence: CITATION_CONFIDENCE,
    researchQuestions: packet.researchBrief?.researchQuestions || [],
    sourceChecklist: packet.sourceChecklist || [],
    candidateClaims: candidateClaims(packet),
    citations: candidateClaims(packet).map((claim) => ({
      claim,
      value: "",
      url: "",
      sourceType: "other",
      accessedAt: now.toISOString().slice(0, 10),
      confidence: "medium",
      quote: "",
    })),
  };
}

export function formatCitedFindingsText(citedPacket) {
  const lines = ["## Cited Findings"];
  if (!citedPacket.citedFindings || citedPacket.citedFindings.length === 0) {
    lines.push("- none (no valid citations attached; external claims remain needs_research)");
  } else {
    for (const f of citedPacket.citedFindings) {
      lines.push(`- ${f.claim}: ${f.value}  [${f.status}, ${f.uncertainty} uncertainty]`);
      lines.push(`  ${f.note}`);
      for (const s of f.sources) {
        lines.push(`  - [${s.urlLabel}/${s.sourceType}] ${s.url} (accessed ${s.accessedAt}, ${s.confidence} confidence)`);
        if (s.quote) lines.push(`    \"${s.quote}\"`);
      }
    }
  }
  if (citedPacket.rejectedCitations && citedPacket.rejectedCitations.length) {
    lines.push("", "## Rejected Citations");
    for (const r of citedPacket.rejectedCitations) {
      const claim = r.input && r.input.claim ? r.input.claim : "(no claim)";
      lines.push(`- ${claim}: ${r.errors.join("; ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
