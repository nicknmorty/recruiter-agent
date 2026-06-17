import { createHash, randomUUID } from "node:crypto";

// Deterministic, local-first application workflow tracking (V3).
//
// This module is the in-memory + serialization core for tracking job
// applications: statuses, contacts, due dates, and follow-ups. It performs no
// network calls and no external actions. Any path that would send email, submit
// an application, or message a recruiter must be gated by explicit human
// approval at the CLI/agent layer; this core only records intent and state.

export const APPLICATION_STATUSES = [
  "interested",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "accepted",
];

// Statuses that mean the application is no longer active.
export const TERMINAL_STATUSES = ["rejected", "withdrawn", "accepted"];

export const TRACKER_SCHEMA_VERSION = 1;

function nowIso(clock) {
  return (clock ? new Date(clock) : new Date()).toISOString();
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = "TRACKER_VALIDATION";
    throw error;
  }
}

function validateStatus(status) {
  assert(
    APPLICATION_STATUSES.includes(status),
    `Invalid status "${status}". Allowed: ${APPLICATION_STATUSES.join(", ")}.`
  );
}

// A due date may be an ISO date (YYYY-MM-DD) or full ISO timestamp. We keep the
// raw string but validate it parses to a real date so reminders stay reliable.
function validateDueDate(due) {
  if (due == null || due === "") return null;
  const text = normalizeString(due);
  const parsed = new Date(text);
  assert(!Number.isNaN(parsed.getTime()), `Invalid due date "${due}". Use YYYY-MM-DD or an ISO timestamp.`);
  return text;
}

export function emptyTrackerState(clock) {
  return {
    schemaVersion: TRACKER_SCHEMA_VERSION,
    updatedAt: nowIso(clock),
    applications: [],
  };
}

export function loadTrackerState(raw, clock) {
  if (raw == null || raw === "") return emptyTrackerState(clock);
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    const err = new Error(`Tracker state is not valid JSON: ${error.message}`);
    err.code = "TRACKER_CORRUPT";
    throw err;
  }
  assert(parsed && typeof parsed === "object", "Tracker state must be an object.");
  assert(Array.isArray(parsed.applications), "Tracker state must include an applications array.");
  return {
    schemaVersion: parsed.schemaVersion || TRACKER_SCHEMA_VERSION,
    updatedAt: parsed.updatedAt || nowIso(clock),
    applications: parsed.applications,
  };
}

export function serializeTrackerState(state) {
  return `${JSON.stringify(state, null, 2)}\n`;
}

// Stable id derived from company+role when the caller does not supply one, so
// re-adding the same posting is detectable. Falls back to a random uuid.
function deriveId({ id, company, role }, idFactory) {
  if (id) return normalizeString(id);
  const key = `${normalizeString(company).toLowerCase()}::${normalizeString(role).toLowerCase()}`;
  if (!key.replace(/::/g, "")) return idFactory ? idFactory() : randomUUID();
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

export function findApplication(state, id) {
  const target = normalizeString(id);
  return state.applications.find((app) => app.id === target) || null;
}

export function addApplication(state, input = {}, { clock, idFactory } = {}) {
  const company = normalizeString(input.company);
  const role = normalizeString(input.role);
  assert(company, "An application requires a company.");
  assert(role, "An application requires a role.");
  const status = normalizeString(input.status) || "interested";
  validateStatus(status);
  const due = validateDueDate(input.due);
  const id = deriveId({ id: input.id, company, role }, idFactory);
  assert(!findApplication(state, id), `An application with id "${id}" already exists.`);

  const ts = nowIso(clock);
  const application = {
    id,
    company,
    role,
    status,
    location: normalizeString(input.location) || null,
    url: normalizeString(input.url) || null,
    contacts: [],
    followUps: [],
    notes: normalizeString(input.notes) || null,
    due,
    createdAt: ts,
    updatedAt: ts,
    history: [{ at: ts, type: "created", status }],
  };
  state.applications.push(application);
  state.updatedAt = ts;
  return application;
}

export function setStatus(state, id, status, { clock } = {}) {
  const app = findApplication(state, id);
  assert(app, `No application found with id "${id}".`);
  validateStatus(status);
  const ts = nowIso(clock);
  const previous = app.status;
  app.status = status;
  app.updatedAt = ts;
  app.history.push({ at: ts, type: "status", from: previous, status });
  state.updatedAt = ts;
  return app;
}

export function addContact(state, id, contact = {}, { clock } = {}) {
  const app = findApplication(state, id);
  assert(app, `No application found with id "${id}".`);
  const name = normalizeString(contact.name);
  assert(name, "A contact requires a name.");
  const ts = nowIso(clock);
  const entry = {
    name,
    role: normalizeString(contact.role) || null,
    email: normalizeString(contact.email) || null,
    phone: normalizeString(contact.phone) || null,
    notes: normalizeString(contact.notes) || null,
    addedAt: ts,
  };
  app.contacts.push(entry);
  app.updatedAt = ts;
  app.history.push({ at: ts, type: "contact", name });
  state.updatedAt = ts;
  return entry;
}

export function addFollowUp(state, id, followUp = {}, { clock } = {}) {
  const app = findApplication(state, id);
  assert(app, `No application found with id "${id}".`);
  const note = normalizeString(followUp.note);
  assert(note, "A follow-up requires a note.");
  const due = validateDueDate(followUp.due);
  const ts = nowIso(clock);
  const entry = {
    note,
    due,
    done: false,
    createdAt: ts,
  };
  app.followUps.push(entry);
  app.updatedAt = ts;
  app.history.push({ at: ts, type: "follow_up", note });
  state.updatedAt = ts;
  return entry;
}

// Returns applications and follow-ups due on or before the reference date.
// Deterministic ordering: overdue first, then by due date, then company.
export function dueItems(state, referenceDate, clock) {
  const ref = referenceDate ? new Date(referenceDate) : (clock ? new Date(clock) : new Date());
  const refTime = ref.getTime();
  const items = [];
  for (const app of state.applications) {
    if (TERMINAL_STATUSES.includes(app.status)) continue;
    if (app.due) {
      const t = new Date(app.due).getTime();
      if (t <= refTime) {
        items.push({ kind: "application_due", id: app.id, company: app.company, role: app.role, due: app.due, overdue: t < refTime });
      }
    }
    for (const f of app.followUps) {
      if (f.done || !f.due) continue;
      const t = new Date(f.due).getTime();
      if (t <= refTime) {
        items.push({ kind: "follow_up_due", id: app.id, company: app.company, role: app.role, note: f.note, due: f.due, overdue: t < refTime });
      }
    }
  }
  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return a.company.localeCompare(b.company);
  });
  return items;
}

export function summarizeTracker(state, { referenceDate, clock } = {}) {
  const byStatus = {};
  for (const status of APPLICATION_STATUSES) byStatus[status] = 0;
  for (const app of state.applications) byStatus[app.status] = (byStatus[app.status] || 0) + 1;
  const active = state.applications.filter((a) => !TERMINAL_STATUSES.includes(a.status)).length;
  return {
    total: state.applications.length,
    active,
    byStatus,
    due: dueItems(state, referenceDate, clock),
  };
}

export function formatTrackerText(state, { referenceDate, clock } = {}) {
  const summary = summarizeTracker(state, { referenceDate, clock });
  const lines = [];
  lines.push("Recruiter Agent — Application Tracker");
  lines.push("=====================================");
  lines.push(`Total: ${summary.total}  Active: ${summary.active}`);
  const statusBits = APPLICATION_STATUSES
    .filter((s) => summary.byStatus[s] > 0)
    .map((s) => `${s}: ${summary.byStatus[s]}`);
  lines.push(`Status: ${statusBits.length ? statusBits.join("  ") : "none yet"}`);
  lines.push("");

  if (summary.due.length) {
    lines.push("Due / follow-ups:");
    for (const item of summary.due) {
      const flag = item.overdue ? "OVERDUE" : "due";
      if (item.kind === "application_due") {
        lines.push(`  [${flag}] ${item.due}  ${item.company} — ${item.role}  (application, id ${item.id})`);
      } else {
        lines.push(`  [${flag}] ${item.due}  ${item.company} — ${item.role}: ${item.note}  (id ${item.id})`);
      }
    }
    lines.push("");
  }

  if (!state.applications.length) {
    lines.push("No applications tracked yet. Add one with `recruiter-agent track add --company <c> --role <r>`.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("Applications:");
  const sorted = [...state.applications].sort((a, b) => a.company.localeCompare(b.company) || a.role.localeCompare(b.role));
  for (const app of sorted) {
    lines.push(`  ${app.company} — ${app.role}  [${app.status}]  (id ${app.id})`);
    if (app.location) lines.push(`    location: ${app.location}`);
    if (app.due) lines.push(`    due: ${app.due}`);
    if (app.contacts.length) {
      for (const c of app.contacts) {
        const bits = [c.name, c.role, c.email, c.phone].filter(Boolean).join(" · ");
        lines.push(`    contact: ${bits}`);
      }
    }
    const openFollowUps = app.followUps.filter((f) => !f.done);
    for (const f of openFollowUps) {
      lines.push(`    follow-up${f.due ? ` (${f.due})` : ""}: ${f.note}`);
    }
    if (app.notes) lines.push(`    notes: ${app.notes}`);
  }
  return `${lines.join("\n")}\n`;
}
