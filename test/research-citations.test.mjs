import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCitation,
  attachCitations,
  buildCitationTemplate,
  labelUrl,
  formatCitedFindingsText,
  normalizeCitationInput,
} from "../lib/research-citations.mjs";
import { buildApplicationResearchPacket } from "../lib/application-research.mjs";

const NOW = new Date("2026-06-03T12:00:00.000Z");

function packet() {
  return buildApplicationResearchPacket({
    jobText: "We are hiring a Data Analyst. Requirements: SQL, Python. https://acme.example/careers",
    topic: "company",
    now: NOW,
  });
}

const goodCitation = {
  claim: "Headcount",
  value: "about 200 employees",
  url: "https://acme.example/about",
  sourceType: "direct_employer",
  accessedAt: "2026-06-03",
  confidence: "high",
  quote: "Acme has roughly 200 employees worldwide.",
};

test("labelUrl classifies hosts deterministically", () => {
  assert.equal(labelUrl("https://acme.example/about").label, "direct_company_domain");
  assert.equal(labelUrl("https://www.linkedin.com/company/acme").label, "job_board");
  assert.equal(labelUrl("https://bit.ly/abc").label, "tracking_or_shortener");
  assert.equal(labelUrl("not a url").label, "unknown");
});

test("validateCitation accepts a complete dated citation", () => {
  const result = validateCitation(goodCitation);
  assert.equal(result.ok, true);
  assert.equal(result.citation.urlLabel, "direct_company_domain");
  assert.match(result.citation.accessedAt, /^2026-06-03T/);
});

test("validateCitation rejects missing url, value, or date (no fabrication)", () => {
  assert.equal(validateCitation({ ...goodCitation, url: "" }).ok, false);
  assert.equal(validateCitation({ ...goodCitation, value: "" }).ok, false);
  assert.equal(validateCitation({ ...goodCitation, accessedAt: "" }).ok, false);
  assert.equal(validateCitation({ ...goodCitation, accessedAt: "someday" }).ok, false);
});

test("validateCitation rejects shortener/tracking and unclassifiable urls", () => {
  assert.equal(validateCitation({ ...goodCitation, url: "https://bit.ly/x" }).ok, false);
  assert.equal(validateCitation({ ...goodCitation, url: "https://acme.example?utm_source=x" }).ok, false);
});

test("attachCitations adds cited findings only for valid citations", () => {
  const cited = attachCitations(packet(), [goodCitation], { now: NOW });
  assert.equal(cited.citationSummary.accepted, 1);
  assert.equal(cited.citationSummary.rejected, 0);
  assert.equal(cited.citedFindings.length, 1);
  assert.equal(cited.citedFindings[0].status, "cited");
  assert.equal(cited.citedFindings[0].value, "about 200 employees");
  const ext = cited.sourceChecklist.find((i) => i.type === "external_research");
  assert.equal(ext.status, "sources_attached");
});

test("buildCitationTemplate creates fillable citation records from a packet", () => {
  const template = buildCitationTemplate(packet(), { now: NOW });
  assert.equal(template.schema, "recruiter-agent.citation-template.v1");
  assert.equal(template.topic, "company");
  assert.ok(template.instructions.some((line) => line.includes("Pass this file back")));
  assert.ok(template.candidateClaims.includes("Company context"));
  assert.ok(template.citations.some((citation) => citation.claim === "Company context"));
  assert.equal(template.citations[0].accessedAt, "2026-06-03");
});

test("normalizeCitationInput accepts arrays and template objects", () => {
  assert.deepEqual(normalizeCitationInput([goodCitation]), [goodCitation]);
  assert.deepEqual(normalizeCitationInput({ citations: [goodCitation] }), [goodCitation]);
  assert.throws(() => normalizeCitationInput({ citation: goodCitation }), /citations array/);
});

test("attachCitations routes invalid citations to rejected and keeps them out of findings", () => {
  const bad = { claim: "Salary", value: "$X", url: "", accessedAt: "" };
  const cited = attachCitations(packet(), [goodCitation, bad], { now: NOW });
  assert.equal(cited.citationSummary.accepted, 1);
  assert.equal(cited.citationSummary.rejected, 1);
  assert.equal(cited.citedFindings.length, 1);
  assert.equal(cited.rejectedCitations[0].errors.length > 0, true);
});

test("corroboration: two sources for one claim lowers uncertainty", () => {
  const second = {
    claim: "Headcount",
    value: "about 200 employees",
    url: "https://reputablepress.example/acme-profile",
    sourceType: "reputable_press",
    accessedAt: "2026-06-02",
    confidence: "medium",
  };
  const cited = attachCitations(packet(), [goodCitation, second], { now: NOW });
  assert.equal(cited.citedFindings.length, 1);
  assert.equal(cited.citedFindings[0].sources.length, 2);
  assert.equal(cited.citedFindings[0].uncertainty, "low");
});

test("no valid citations leaves external research as needs_research", () => {
  const cited = attachCitations(packet(), [{ claim: "x" }], { now: NOW });
  assert.equal(cited.citedFindings.length, 0);
  const ext = cited.sourceChecklist.find((i) => i.type === "external_research");
  assert.equal(ext.status, "needs_research");
});

test("formatCitedFindingsText renders cited and rejected sections", () => {
  const cited = attachCitations(packet(), [goodCitation, { claim: "bad", value: "y", url: "", accessedAt: "" }], { now: NOW });
  const text = formatCitedFindingsText(cited);
  assert.match(text, /## Cited Findings/);
  assert.match(text, /Headcount: about 200 employees/);
  assert.match(text, /## Rejected Citations/);
});
