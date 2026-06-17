#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildApplicationResearchPacket, formatApplicationResearchPacketText } from "../lib/application-research.mjs";
import { buildBottomFeederBrief, formatBottomFeederBriefText } from "../lib/bottom-feeder-brief.mjs";
import { formatReviewText, reviewResume } from "../lib/resume-review.mjs";
import {
  attachCitations,
  buildCitationTemplate,
  formatCitedFindingsText,
  normalizeCitationInput,
} from "../lib/research-citations.mjs";
import {
  addApplication,
  addContact,
  addFollowUp,
  emptyTrackerState,
  formatTrackerText,
  loadTrackerState,
  serializeTrackerState,
  setStatus,
  summarizeTracker,
} from "../lib/application-tracker.mjs";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] || 'status';

if (command === 'status') {
  console.log('recruiter-agent: V2/V3 deterministic core available; try `recruiter-agent review --resume <file> [--job <file>]`, `recruiter-agent research --job <file> [--resume <file>]`, or `recruiter-agent track list` (application workflow tracking).');
  process.exit(0);
}

function usage(exitCode = 0) {
  const output = [
    "Usage:",
    "  recruiter-agent status",
    "  recruiter-agent doctor [--format text|json]",
    "  recruiter-agent review --resume <path> [--job <path>] [--notes <path>] [--format text|json] [--out <path-or-dir>]",
    "  recruiter-agent bottom-feeder --job <path> [--resume <path>] [--notes <path>] [--topic role|company|compensation|workflow|application] [--format text|json] [--out <path-or-dir>]",
    "  recruiter-agent research --job <path> [--resume <path>] [--notes <path>] [--topic role|company|compensation|workflow|application] [--citation-template] [--citations <citations.json>] [--format text|json] [--out <path-or-dir>]",
    "  recruiter-agent track list|due|add|status|contact|followup ...   (application workflow tracking; run `track --help`)",
    "",
    "Review, Bottom Feeder handoff, Track B research packets, and application tracking are deterministic and local-first. They do not call an LLM, send resume data anywhere, or take external actions.",
  ].join("\n");
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${output}\n`);
  process.exit(exitCode);
}

function parseFormatOnlyArgs(argv) {
  const options = { format: "text" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--format") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        console.error("Missing value for --format.");
        usage(1);
      }
      options.format = value;
      i += 1;
    } else if (arg === "--help" || arg === "-h") usage(0);
    else {
      console.error(`Unknown option: ${arg}`);
      usage(1);
    }
  }
  if (!["json", "text"].includes(options.format)) {
    console.error("Format must be `text` or `json`.");
    usage(1);
  }
  return options;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function check(status, id, message, details = {}) {
  return { id, status, message, ...details };
}

async function buildDoctorReport({ now = new Date() } = {}) {
  const checks = [];
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  checks.push(nodeMajor >= 20
    ? check("ok", "node_version", `Node ${process.versions.node} is supported.`)
    : check("fail", "node_version", `Node ${process.versions.node} is too old; use Node 20 or newer.`));

  const gitignorePath = path.join(repoRoot, ".gitignore");
  const gitignore = await readFile(gitignorePath, "utf8");
  const hasRunsIgnore = /^\/runs\/\*/m.test(gitignore) && /^!\/runs\/\.gitkeep/m.test(gitignore);
  const hasStateIgnore = /^\/state\/\*/m.test(gitignore) && /^!\/state\/\.gitkeep/m.test(gitignore);
  checks.push(hasRunsIgnore
    ? check("ok", "runs_gitignore", "runs/ is gitignored except .gitkeep.")
    : check("fail", "runs_gitignore", "runs/ privacy gitignore pattern is missing or incomplete."));
  checks.push(hasStateIgnore
    ? check("ok", "state_gitignore", "state/ is gitignored except .gitkeep.")
    : check("fail", "state_gitignore", "state/ privacy gitignore pattern is missing or incomplete."));

  for (const dir of ["runs", "state"]) {
    const dirPath = path.join(repoRoot, dir);
    const present = await exists(dirPath);
    checks.push(present
      ? check("ok", `${dir}_dir`, `${dir}/ directory exists.`)
      : check("warn", `${dir}_dir`, `${dir}/ directory is missing; commands can recreate it when needed.`));
  }

  const exampleFiles = [
    "examples/support-automation/resume.txt",
    "examples/support-automation/job-posting.txt",
    "examples/support-automation/notes.txt",
    "examples/support-automation/citations.json",
    "scripts/smoke-test.mjs",
  ];
  const missingExamples = [];
  for (const relativePath of exampleFiles) {
    if (!await exists(path.join(repoRoot, relativePath))) missingExamples.push(relativePath);
  }
  checks.push(missingExamples.length === 0
    ? check("ok", "example_scenario", "Sanitized support-automation smoke scenario is present.")
    : check("fail", "example_scenario", "Smoke scenario files are missing.", { missing: missingExamples }));

  try {
    await execFileAsync("pdftotext", ["-v"]);
    checks.push(check("ok", "pdftotext", "Local pdftotext is available for PDF resume extraction."));
  } catch (error) {
    const missing = error?.code === "ENOENT";
    checks.push(check("warn", "pdftotext", missing
      ? "pdftotext is not installed; PDF resumes will fail gracefully. Use text, Markdown, or DOCX for testing."
      : "pdftotext probe returned a warning; PDF extraction may fail gracefully.", { error: error.message }));
  }

  const summary = {
    ok: checks.filter((item) => item.status === "ok").length,
    warn: checks.filter((item) => item.status === "warn").length,
    fail: checks.filter((item) => item.status === "fail").length,
  };
  return {
    schema: "recruiter-agent.doctor.v1",
    generatedAt: now.toISOString(),
    status: summary.fail ? "fail" : summary.warn ? "warn" : "ok",
    summary,
    checks,
  };
}

function formatDoctorText(report) {
  const lines = [
    "Recruiter Agent Doctor",
    `Status: ${report.status}`,
    `Checks: ${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail`,
    "",
  ];
  for (const item of report.checks) {
    lines.push(`- [${item.status}] ${item.id}: ${item.message}`);
    if (item.missing) lines.push(`  Missing: ${item.missing.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

if (command === "doctor") {
  const options = parseFormatOnlyArgs(process.argv.slice(3));
  try {
    const report = await buildDoctorReport();
    const output = options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatDoctorText(report);
    process.stdout.write(output);
    process.exit(report.status === "fail" ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const options = {
    resume: null,
    job: null,
    notes: null,
    format: "text",
    out: null,
  };

  function readOptionValue(argv, index, optionName) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for ${optionName}.`);
      usage(1);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--resume") {
      options.resume = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--job") {
      options.job = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--notes") {
      options.notes = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--format") {
      options.format = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--out") {
      options.out = readOptionValue(argv, i, arg);
      i += 1;
    }
    else if (arg === "--help" || arg === "-h") usage(0);
    else {
      console.error(`Unknown option: ${arg}`);
      usage(1);
    }
  }

  if (!options.resume) {
    console.error("Missing required option: --resume <path>");
    usage(1);
  }
  if (!["json", "text"].includes(options.format)) {
    console.error("Format must be `text` or `json`.");
    usage(1);
  }

  return options;
}

function parseBottomFeederArgs(argv) {
  const options = {
    resume: null,
    job: null,
    notes: null,
    topic: "role",
    format: "text",
    out: null,
    citations: null,
    citationTemplate: false,
  };

  function readOptionValue(argv, index, optionName) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for ${optionName}.`);
      usage(1);
    }
    return value;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--resume") {
      options.resume = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--job") {
      options.job = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--citations") {
      options.citations = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--citation-template") {
      options.citationTemplate = true;
    } else if (arg === "--notes") {
      options.notes = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--topic") {
      options.topic = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--format") {
      options.format = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--out") {
      options.out = readOptionValue(argv, i, arg);
      i += 1;
    } else if (arg === "--help" || arg === "-h") usage(0);
    else {
      console.error(`Unknown option: ${arg}`);
      usage(1);
    }
  }

  if (!options.job) {
    console.error("Missing required option: --job <path>");
    usage(1);
  }
  if (!["json", "text"].includes(options.format)) {
    console.error("Format must be `text` or `json`.");
    usage(1);
  }
  if (!["role", "company", "compensation", "workflow", "application"].includes(options.topic)) {
    console.error("Topic must be one of: role, company, compensation, workflow, application.");
    usage(1);
  }
  if (options.citationTemplate && options.citations) {
    console.error("Use either --citation-template or --citations, not both.");
    usage(1);
  }

  return options;
}

function datedReportName(format, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `resume-review-${stamp}.${format === "json" ? "json" : "md"}`;
}

function datedBottomFeederBriefName(format, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `bottom-feeder-brief-${stamp}.${format === "json" ? "json" : "md"}`;
}

function datedResearchPacketName(format, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `application-research-${stamp}.${format === "json" ? "json" : "md"}`;
}

function datedCitationTemplateName(format, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `research-citations-template-${stamp}.json`;
}

async function pathExistsAsDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function resolveOutputPath(outPath, format) {
  const normalized = path.normalize(outPath);
  const explicitDirectory = normalized.endsWith(path.sep) || await pathExistsAsDirectory(normalized);
  const hasExtension = path.extname(normalized) !== "";
  if (explicitDirectory || !hasExtension) {
    await mkdir(normalized, { recursive: true });
    return path.join(normalized, datedReportName(format));
  }

  await mkdir(path.dirname(normalized), { recursive: true });
  return normalized;
}

async function resolveNamedOutputPath(outPath, format, fileNameFactory) {
  const normalized = path.normalize(outPath);
  const explicitDirectory = normalized.endsWith(path.sep) || await pathExistsAsDirectory(normalized);
  const hasExtension = path.extname(normalized) !== "";
  if (explicitDirectory || !hasExtension) {
    await mkdir(normalized, { recursive: true });
    return path.join(normalized, fileNameFactory(format));
  }

  await mkdir(path.dirname(normalized), { recursive: true });
  return normalized;
}

async function readInputFile(filePath) {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  let extraction;
  if (extension === ".docx") {
    extraction = await extractDocxText(filePath);
  } else if (extension === ".pdf") {
    extraction = await extractPdfText(filePath);
  } else {
    extraction = { text: buffer.toString("utf8"), inputFormat: "text" };
  }

  return {
    text: extraction.text,
    metadata: {
      fileName: path.basename(filePath),
      byteLength: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      inputFormat: extraction.inputFormat,
    },
  };
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractParagraphText(paragraphXml) {
  const textParts = [];
  for (const match of paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)) {
    textParts.push(decodeXmlText(match[1]));
  }
  return textParts.join("").replace(/[ \t]+/g, " ").trim();
}

function paragraphStyle(paragraphXml) {
  return paragraphXml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] || "";
}

function normalizeDocxParagraph(paragraphXml) {
  const text = extractParagraphText(paragraphXml);
  if (!text) return null;

  const style = paragraphStyle(paragraphXml);
  const isHeading = /^Heading\d+$/i.test(style);
  const isList = /<w:numPr\b/i.test(paragraphXml) || /(?:List|Bullet)/i.test(style);
  if (isList && !/^[-*•]\s+/.test(text)) return `- ${text}`;
  if (isHeading) return text;
  return text;
}

async function commandExists(command) {
  try {
    await execFileAsync("sh", ["-c", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

// Local-only PDF text extraction. Uses a local `pdftotext` (poppler) if present.
// If no trusted local extractor is available, fail gracefully with an actionable
// message rather than attempting weak/unreliable binary parsing. Adds no deps.
async function extractPdfText(filePath) {
  if (!(await commandExists("pdftotext"))) {
    throw new Error(
      `PDF input is not supported on this host: no local 'pdftotext' (poppler-utils) extractor found. ` +
        `Export the resume to plain text, Markdown, or DOCX and re-run, or install poppler-utils to enable local PDF extraction. ` +
        `(file: ${filePath})`
    );
  }

  let stdout;
  try {
    ({ stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", filePath, "-"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }));
  } catch (error) {
    throw new Error(`Unable to extract PDF text from ${filePath}: ${error.message}`);
  }

  return {
    text: `${stdout.trim()}\n`,
    inputFormat: "pdf",
  };
}

async function extractDocxText(filePath) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync("unzip", ["-p", filePath, "word/document.xml"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    }));
  } catch (error) {
    throw new Error(`Unable to extract DOCX text from ${filePath}: ${error.message}`);
  }

  const paragraphs = [...stdout.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((match) => normalizeDocxParagraph(match[0]))
    .filter(Boolean);

  return {
    text: `${paragraphs.join("\n")}\n`,
    inputFormat: "docx",
  };
}

function attachRunMetadata(review, { resume, job, notes }) {
  return {
    ...review,
    run: {
      sourcePolicy: {
        pathDetail: "basename_only",
        digest: "sha256",
        privatePathsOmitted: true,
      },
      inputs: {
        resume,
        job: job || null,
        notes: notes || null,
      },
    },
  };
}

if (command === "review") {
  const options = parseArgs(process.argv.slice(3));
  try {
    const resumeInput = await readInputFile(options.resume);
    const jobInput = options.job ? await readInputFile(options.job) : null;
    const notesInput = options.notes ? await readInputFile(options.notes) : null;
    const review = attachRunMetadata(
      reviewResume({
        resumeText: resumeInput.text,
        jobText: jobInput?.text || "",
        notesText: notesInput?.text || "",
      }),
      { resume: resumeInput.metadata, job: jobInput?.metadata, notes: notesInput?.metadata }
    );
    const output = options.format === "json"
      ? `${JSON.stringify(review, null, 2)}\n`
      : formatReviewText(review);
    if (options.out) {
      const outputPath = await resolveOutputPath(options.out, options.format);
      await writeFile(outputPath, output);
    }
    process.stdout.write(output);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (command === "bottom-feeder") {
  const options = parseBottomFeederArgs(process.argv.slice(3));
  try {
    const jobInput = await readInputFile(options.job);
    const resumeInput = options.resume ? await readInputFile(options.resume) : null;
    const notesInput = options.notes ? await readInputFile(options.notes) : null;
    const brief = buildBottomFeederBrief({
      jobText: jobInput.text,
      resumeText: resumeInput?.text || "",
      notesText: notesInput?.text || "",
      topic: options.topic,
    });
    const output = options.format === "json"
      ? `${JSON.stringify(brief, null, 2)}\n`
      : formatBottomFeederBriefText(brief);
    if (options.out) {
      const outputPath = await resolveNamedOutputPath(options.out, options.format, datedBottomFeederBriefName);
      await writeFile(outputPath, output);
    }
    process.stdout.write(output);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (command === "research") {
  const options = parseBottomFeederArgs(process.argv.slice(3));
  try {
    const jobInput = await readInputFile(options.job);
    const resumeInput = options.resume ? await readInputFile(options.resume) : null;
    const notesInput = options.notes ? await readInputFile(options.notes) : null;
    let packet = buildApplicationResearchPacket({
      jobText: jobInput.text,
      resumeText: resumeInput?.text || "",
      notesText: notesInput?.text || "",
      topic: options.topic,
    });
    if (options.citationTemplate) {
      const template = buildCitationTemplate(packet);
      const output = `${JSON.stringify(template, null, 2)}\n`;
      if (options.out) {
        const outputPath = await resolveNamedOutputPath(options.out, "json", datedCitationTemplateName);
        await writeFile(outputPath, output);
      }
      process.stdout.write(output);
      process.exit(0);
    }
    // Optional Track B citation layer: merge a reviewed citations JSON file
    // (array of citation records, or a template object with citations[]). The
    // CLI never fetches sources itself; it only validates and attaches what a
    // reviewer supplies, so unsupported claims stay needs_research.
    if (options.citations) {
      let citations;
      try {
        citations = normalizeCitationInput(JSON.parse(await readFile(options.citations, "utf8")));
      } catch (error) {
        throw new Error(`Could not read citations file ${options.citations}: ${error.message}`);
      }
      packet = attachCitations(packet, citations);
    }
    const output = options.format === "json"
      ? `${JSON.stringify(packet, null, 2)}\n`
      : `${formatApplicationResearchPacketText(packet)}${options.citations ? `\n${formatCitedFindingsText(packet)}` : ""}`;
    if (options.out) {
      const outputPath = await resolveNamedOutputPath(options.out, options.format, datedResearchPacketName);
      await writeFile(outputPath, output);
    }
    process.stdout.write(output);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// ----- V3: Application workflow tracking (deterministic, local-first) -----
//
// State persists to a gitignored local file (state/applications.json by
// default, overridable with --state). No network calls, no external actions.
// Verbs that would touch the outside world (email, submit, message) are NOT
// implemented here; they require explicit human approval per docs/SAFETY_BOUNDARIES.md.

const TRACKER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "state");
const DEFAULT_TRACKER_PATH = path.join(TRACKER_DIR, "applications.json");

function parseTrackArgs(argv) {
  const options = { _: [], format: "text", state: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = value;
        i += 1;
      }
    } else {
      options._.push(arg);
    }
  }
  if (options.format && !["text", "json"].includes(options.format)) {
    console.error("Format must be `text` or `json`.");
    process.exit(1);
  }
  return options;
}

async function readTrackerState(statePath) {
  try {
    const raw = await readFile(statePath, "utf8");
    return loadTrackerState(raw);
  } catch (error) {
    if (error?.code === "ENOENT") return emptyTrackerState();
    throw error;
  }
}

async function writeTrackerState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, serializeTrackerState(state));
}

function trackUsage(exitCode = 0) {
  const out = [
    "Usage:",
    "  recruiter-agent track list [--format text|json] [--state <path>]",
    "  recruiter-agent track due [--on <YYYY-MM-DD>] [--format text|json] [--state <path>]",
    "  recruiter-agent track add --company <c> --role <r> [--status <s>] [--location <l>] [--url <u>] [--due <date>] [--notes <n>]",
    "  recruiter-agent track status <id> --to <status>",
    "  recruiter-agent track contact <id> --name <n> [--role <r>] [--email <e>] [--phone <p>] [--notes <n>]",
    "  recruiter-agent track followup <id> --note <n> [--due <date>]",
    "",
    "Tracking is deterministic and local-only. It records intent and state; it does",
    "not send email, submit applications, or message recruiters. Those require",
    "explicit human approval (see docs/SAFETY_BOUNDARIES.md).",
  ].join("\n");
  (exitCode === 0 ? process.stdout : process.stderr).write(`${out}\n`);
  process.exit(exitCode);
}

if (command === "track") {
  const sub = process.argv[3];
  const options = parseTrackArgs(process.argv.slice(4));
  const statePath = options.state ? path.resolve(String(options.state)) : DEFAULT_TRACKER_PATH;
  try {
    const state = await readTrackerState(statePath);
    let mutated = false;
    let textOutput = null;
    let jsonOutput = null;

    if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
      trackUsage(0);
    } else if (sub === "list") {
      jsonOutput = summarizeTracker(state);
      textOutput = formatTrackerText(state);
    } else if (sub === "due") {
      const summary = summarizeTracker(state, { referenceDate: options.on || undefined });
      jsonOutput = { due: summary.due };
      textOutput = formatTrackerText(state, { referenceDate: options.on || undefined });
    } else if (sub === "add") {
      const app = addApplication(state, {
        company: options.company,
        role: options.role,
        status: options.status,
        location: options.location,
        url: options.url,
        due: options.due,
        notes: options.notes,
      });
      mutated = true;
      jsonOutput = app;
      textOutput = `Added ${app.company} — ${app.role} [${app.status}] (id ${app.id}).\n`;
    } else if (sub === "status") {
      const id = options._[0];
      if (!id || !options.to) {
        console.error("track status requires <id> and --to <status>.");
        trackUsage(1);
      }
      const app = setStatus(state, id, String(options.to));
      mutated = true;
      jsonOutput = app;
      textOutput = `Updated ${app.company} — ${app.role} to [${app.status}].\n`;
    } else if (sub === "contact") {
      const id = options._[0];
      if (!id) {
        console.error("track contact requires <id>.");
        trackUsage(1);
      }
      const contact = addContact(state, id, {
        name: options.name,
        role: options.role,
        email: options.email,
        phone: options.phone,
        notes: options.notes,
      });
      mutated = true;
      jsonOutput = contact;
      textOutput = `Added contact ${contact.name} to application ${id}.\n`;
    } else if (sub === "followup") {
      const id = options._[0];
      if (!id || !options.note) {
        console.error("track followup requires <id> and --note <text>.");
        trackUsage(1);
      }
      const followUp = addFollowUp(state, id, { note: options.note, due: options.due });
      mutated = true;
      jsonOutput = followUp;
      textOutput = `Added follow-up to application ${id}${followUp.due ? ` (due ${followUp.due})` : ""}.\n`;
    } else {
      console.error(`Unknown track subcommand: ${sub}`);
      trackUsage(1);
    }

    if (mutated) await writeTrackerState(statePath, state);
    const output = options.format === "json" ? `${JSON.stringify(jsonOutput, null, 2)}\n` : textOutput;
    process.stdout.write(output);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (command === "--help" || command === "-h" || command === "help") usage(0);

console.error(`Unknown command: ${command}`);
usage(1);
process.exit(1);
