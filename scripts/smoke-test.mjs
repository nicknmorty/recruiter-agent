#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repoRoot, "bin", "recruiter-agent.mjs");
const scenario = path.join(repoRoot, "examples", "support-automation");
const tempDir = mkdtempSync(path.join(tmpdir(), "recruiter-agent-smoke-"));
const outDir = path.join(tempDir, "runs");
const statePath = path.join(tempDir, "state", "applications.json");

function run(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runJson(args) {
  return JSON.parse(run([...args, "--format", "json"]));
}

try {
  const resume = path.join(scenario, "resume.txt");
  const job = path.join(scenario, "job-posting.txt");
  const notes = path.join(scenario, "notes.txt");
  const citations = path.join(scenario, "citations.json");

  const review = runJson(["review", "--resume", resume, "--job", job, "--notes", notes]);
  assert.equal(review.schema, "recruiter-agent.resume-review.v0");
  assert.equal(review.userNotes.checked, true);
  assert.ok(review.jobFit.score > 0, "expected job-fit score to be nonzero");
  assert.ok(review.evidenceMap.hardRequirements.length > 0, "expected hard requirement evidence map");
  assert.equal(review.finalDraftChecklist.checked, true);
  assert.ok(review.finalDraftChecklist.items.length > 0, "expected final draft checklist");

  const template = JSON.parse(run([
    "research",
    "--job",
    job,
    "--resume",
    resume,
    "--notes",
    notes,
    "--topic",
    "company",
    "--citation-template",
    "--out",
    outDir,
  ]));
  assert.equal(template.schema, "recruiter-agent.citation-template.v1");
  assert.ok(template.citations.length > 0, "expected fillable citation records");
  assert.ok(readdirSync(outDir).some((file) => /^research-citations-template-/.test(file)));

  const cited = runJson([
    "research",
    "--job",
    job,
    "--resume",
    resume,
    "--notes",
    notes,
    "--topic",
    "company",
    "--citations",
    citations,
  ]);
  assert.equal(cited.schema, "recruiter-agent.application-research.v1");
  assert.equal(cited.citationSummary.accepted, 3);
  assert.equal(cited.rejectedCitations.length, 0);
  assert.ok(cited.citedFindings.some((finding) => finding.claim === "Company context"));

  const added = runJson([
    "track",
    "add",
    "--company",
    "Northstar Analytics",
    "--role",
    "Support Automation Analyst",
    "--status",
    "interested",
    "--location",
    "Remote US",
    "--url",
    "https://northstar-analytics.example/careers/support-automation-analyst",
    "--due",
    "2026-06-10",
    "--notes",
    "Smoke-test example only.",
    "--state",
    statePath,
  ]);
  assert.ok(added.id, "expected tracked application id");

  const due = runJson(["track", "due", "--on", "2026-06-10", "--state", statePath]);
  assert.equal(due.due.length, 1);
  assert.equal(existsSync(statePath), true);

  if (process.env.RECRUITER_AGENT_KEEP_SMOKE) {
    console.log(`Smoke test passed. Temp artifacts kept at: ${tempDir}`);
  } else {
    console.log("Smoke test passed.");
  }
} finally {
  if (!process.env.RECRUITER_AGENT_KEEP_SMOKE) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
