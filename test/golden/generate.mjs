#!/usr/bin/env node
// Regenerate golden report fixtures from the fake test fixtures.
//
// Usage: node test/golden/generate.mjs
//
// Runs the CLI against test/fixtures/fake-resume.txt (+ fake-job.txt), normalizes
// volatile fields, and writes the golden text and JSON reports under test/golden/.
// Re-run this only when an output-shape change is intentional, then review the diff.

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReviewText, stableJsonString } from "./normalize.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const cliPath = path.join(repoRoot, "bin", "recruiter-agent.mjs");
const resumePath = path.join(repoRoot, "test", "fixtures", "fake-resume.txt");
const jobPath = path.join(repoRoot, "test", "fixtures", "fake-job.txt");

function runCli(args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`CLI failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout;
}

const jsonOut = runCli(["review", "--resume", resumePath, "--job", jobPath, "--format", "json"]);
const textOut = runCli(["review", "--resume", resumePath, "--job", jobPath, "--format", "text"]);

const goldenJson = stableJsonString(JSON.parse(jsonOut));
const goldenText = normalizeReviewText(textOut);

writeFileSync(path.join(here, "review-with-job.json"), goldenJson);
writeFileSync(path.join(here, "review-with-job.txt"), goldenText);

console.log("Wrote golden fixtures: review-with-job.json, review-with-job.txt");
