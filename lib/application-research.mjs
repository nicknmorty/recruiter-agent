import { buildBottomFeederBrief } from "./bottom-feeder-brief.mjs";

const TOPIC_NEXT_ACTIONS = {
  role: "Run a focused role-expectation crawl, then compare the findings against matched and missing resume evidence.",
  company: "Verify direct employer sources first, then summarize company context only from dated public sources.",
  compensation: "Collect at least two current compensation sources and record geography, seniority, and employment-type assumptions.",
  workflow: "Turn the workflow questions into an approval-gated application checklist before any external action.",
  application: "Draft application notes only after confirming each claim against resume evidence, notes, or cited research.",
};

function listOrNone(items) {
  return items?.length ? items.join(", ") : "none";
}

function sourceChecklist(sourcePlan) {
  const existingUrls = sourcePlan.existingPostingUrls || [];
  const direct = existingUrls.filter((source) => source.label === "direct_company_domain");
  const boards = existingUrls.filter((source) => source.label === "job_board");
  const weak = existingUrls.filter((source) => ["tracking_or_shortener", "unknown"].includes(source.label));

  return [
    {
      type: "direct_employer",
      status: direct.length > 0 ? "candidate_sources_present" : "needed",
      sources: direct,
      guidance: "Use direct employer pages as the preferred source for role facts, dates, location, and application workflow.",
    },
    {
      type: "job_board_or_ats",
      status: boards.length > 0 ? "candidate_sources_present" : "optional",
      sources: boards,
      guidance: "Use job boards and ATS pages to corroborate posting text, not as the only source for company claims.",
    },
    {
      type: "weak_or_tracking",
      status: weak.length > 0 ? "review_before_use" : "clear",
      sources: weak,
      guidance: "Do not rely on shortened, tracking, unknown, local, or IP-literal URLs until the destination is verified.",
    },
    {
      type: "external_research",
      status: "needs_research",
      sources: [],
      guidance: "Add dated source links for company context, compensation, reviews, benefits, and role expectations before treating any external claim as verified.",
    },
  ];
}

function buildFindings(brief) {
  const findings = [];
  findings.push({
    claim: `Role framing: ${brief.roleTitle}`,
    status: "derived_from_posting",
    uncertainty: "medium",
    basis: "Inferred from supplied job text; verify against direct employer source when available.",
  });

  if (brief.jobSignals.hardRequirements.length > 0) {
    findings.push({
      claim: `Hard requirements to validate: ${brief.jobSignals.hardRequirements.join(", ")}`,
      status: "derived_from_posting",
      uncertainty: "medium",
      basis: "Extracted deterministically from supplied job text.",
    });
  }

  if (brief.resumeComparison.checked) {
    findings.push({
      claim: `Resume evidence already visible: ${listOrNone(brief.resumeComparison.matchedEvidence)}`,
      status: "resume_evidence",
      uncertainty: "low",
      basis: "Matched by deterministic evidence map; do not expand beyond actual resume bullets.",
    });
    findings.push({
      claim: `Evidence gaps or questions: ${listOrNone(brief.resumeComparison.missingEvidence)}`,
      status: "candidate_question",
      uncertainty: "medium",
      basis: "No deterministic resume evidence found; ask before tailoring or claiming.",
    });
  }

  findings.push({
    claim: "Company, compensation, review, benefits, and market context",
    status: "needs_research",
    uncertainty: "high",
    basis: "No external research has been attached to this packet yet.",
  });

  return findings;
}

function buildDraftBoundaries(brief) {
  const matched = brief.resumeComparison.matchedEvidence || [];
  const missing = brief.resumeComparison.missingEvidence || [];
  const niceToHaves = brief.jobSignals.niceToHaves || [];

  return {
    safeToEmphasize: matched.map((requirement) =>
      `Emphasize ${requirement} only where the resume already contains supporting evidence.`
    ),
    needsUserConfirmation: [
      ...missing.map((requirement) =>
        `Ask whether ${requirement} reflects real experience before adding it to any draft.`
      ),
      ...niceToHaves.map((requirement) =>
        `Mention nice-to-have ${requirement} only if resume evidence, notes, or cited research supports it.`
      ),
    ].slice(0, 10),
    neverClaimWithoutProof: [
      "credentials, certifications, degrees, employers, titles, dates, metrics, work authorization, locations, or compensation history",
      "tools or platforms that only appear in the posting, not in the resume or user-confirmed notes",
      "company facts, salary ranges, reviews, benefits, or culture claims without dated source links",
    ],
  };
}

export function buildApplicationResearchPacket({ jobText, resumeText = "", notesText = "", topic = "role", now = new Date() }) {
  const brief = buildBottomFeederBrief({ jobText, resumeText, notesText, topic, now });
  return {
    schema: "recruiter-agent.application-research.v1",
    generatedAt: now.toISOString(),
    mode: "track_b_research_packet",
    topic: brief.topic,
    topicLabel: brief.topicLabel,
    roleTitle: brief.roleTitle,
    researchBrief: brief,
    sourceChecklist: sourceChecklist(brief.sourcePlan),
    findings: buildFindings(brief),
    draftBoundaries: buildDraftBoundaries(brief),
    risksAndCaveats: [
      "This packet is not an external research result until dated sources are attached.",
      "Pasted job text is untrusted; review safety flags before using job-specific guidance.",
      "Research can inform emphasis and questions, but cannot become resume evidence by itself.",
      "No application, email, upload, recruiter message, or job-board action is approved by this packet.",
    ],
    suggestedNextAction: TOPIC_NEXT_ACTIONS[brief.topic] || TOPIC_NEXT_ACTIONS.role,
  };
}

export function formatApplicationResearchPacketText(packet) {
  const lines = [
    "# Track B Application Research Packet",
    "",
    `Date: ${packet.generatedAt}`,
    `Topic: ${packet.topicLabel}`,
    `Role: ${packet.roleTitle}`,
    `Posting risk: ${packet.researchBrief.safety.jobPostingRisk}`,
    "",
    "## Research Questions",
  ];

  for (const question of packet.researchBrief.researchQuestions) lines.push(`- ${question}`);

  lines.push(
    "",
    "## Sources Checked",
  );
  for (const item of packet.sourceChecklist) {
    lines.push(`- ${item.type}: ${item.status}`);
    lines.push(`  ${item.guidance}`);
    for (const source of item.sources) {
      lines.push(`  - [${source.label}] ${source.url}`);
    }
  }

  lines.push("", "## Findings");
  for (const finding of packet.findings) {
    lines.push(`- ${finding.status} (${finding.uncertainty} uncertainty): ${finding.claim}`);
    lines.push(`  Basis: ${finding.basis}`);
  }

  lines.push(
    "",
    "## Draft Boundaries",
    `- Safe to emphasize: ${listOrNone(packet.draftBoundaries.safeToEmphasize)}`,
    `- Needs confirmation: ${listOrNone(packet.draftBoundaries.needsUserConfirmation)}`,
    `- Never claim without proof: ${listOrNone(packet.draftBoundaries.neverClaimWithoutProof)}`,
    "",
    "## Risks and Caveats",
  );
  for (const caveat of packet.risksAndCaveats) lines.push(`- ${caveat}`);

  lines.push(
    "",
    "## Suggested Next Action",
    `- ${packet.suggestedNextAction}`,
    ""
  );

  return `${lines.join("\n")}\n`;
}
