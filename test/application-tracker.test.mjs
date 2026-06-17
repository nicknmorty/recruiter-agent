import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addApplication,
  addContact,
  addFollowUp,
  emptyTrackerState,
  loadTrackerState,
  serializeTrackerState,
  setStatus,
  summarizeTracker,
  dueItems,
  APPLICATION_STATUSES,
} from "../lib/application-tracker.mjs";

const CLOCK = "2026-06-03T12:00:00.000Z";

function seed() {
  const state = emptyTrackerState(CLOCK);
  const app = addApplication(state, { company: "Acme", role: "Data Analyst", due: "2026-06-10" }, { clock: CLOCK });
  return { state, app };
}

test("addApplication requires company and role", () => {
  const state = emptyTrackerState(CLOCK);
  assert.throws(() => addApplication(state, { role: "X" }), /requires a company/);
  assert.throws(() => addApplication(state, { company: "Y" }), /requires a role/);
});

test("addApplication derives a stable id from company+role", () => {
  const a = emptyTrackerState(CLOCK);
  const b = emptyTrackerState(CLOCK);
  const one = addApplication(a, { company: "Acme", role: "Data Analyst" }, { clock: CLOCK });
  const two = addApplication(b, { company: "acme", role: "data analyst" }, { clock: CLOCK });
  assert.equal(one.id, two.id);
});

test("duplicate id is rejected", () => {
  const { state } = seed();
  assert.throws(() => addApplication(state, { company: "Acme", role: "Data Analyst" }, { clock: CLOCK }), /already exists/);
});

test("setStatus validates and records history", () => {
  const { state, app } = seed();
  assert.throws(() => setStatus(state, app.id, "bogus"), /Invalid status/);
  setStatus(state, app.id, "applied", { clock: CLOCK });
  assert.equal(app.status, "applied");
  const statusEvent = app.history.find((h) => h.type === "status");
  assert.equal(statusEvent.from, "interested");
  assert.equal(statusEvent.status, "applied");
});

test("contacts and follow-ups attach with validation", () => {
  const { state, app } = seed();
  assert.throws(() => addContact(state, app.id, {}), /requires a name/);
  addContact(state, app.id, { name: "Jane", email: "jane@acme.test" }, { clock: CLOCK });
  assert.equal(app.contacts.length, 1);
  assert.throws(() => addFollowUp(state, app.id, {}), /requires a note/);
  addFollowUp(state, app.id, { note: "send thanks", due: "2026-06-05" }, { clock: CLOCK });
  assert.equal(app.followUps.length, 1);
});

test("invalid due date is rejected", () => {
  const { state, app } = seed();
  assert.throws(() => addFollowUp(state, app.id, { note: "x", due: "not-a-date" }), /Invalid due date/);
});

test("dueItems flags overdue and orders overdue first", () => {
  const { state, app } = seed();
  addFollowUp(state, app.id, { note: "call back", due: "2026-06-01" }, { clock: CLOCK });
  const items = dueItems(state, "2026-06-06");
  // follow-up (2026-06-01) overdue; application due (2026-06-10) not yet due
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "follow_up_due");
  assert.equal(items[0].overdue, true);
});

test("terminal-status applications drop out of due tracking", () => {
  const { state, app } = seed();
  setStatus(state, app.id, "rejected", { clock: CLOCK });
  const items = dueItems(state, "2026-06-30");
  assert.equal(items.length, 0);
  const summary = summarizeTracker(state, { referenceDate: "2026-06-30" });
  assert.equal(summary.active, 0);
  assert.equal(summary.total, 1);
});

test("serialize round-trips through loadTrackerState", () => {
  const { state, app } = seed();
  addContact(state, app.id, { name: "Jane" }, { clock: CLOCK });
  const raw = serializeTrackerState(state);
  const reloaded = loadTrackerState(raw);
  assert.deepEqual(reloaded.applications, state.applications);
});

test("loadTrackerState rejects corrupt JSON and bad shape", () => {
  assert.throws(() => loadTrackerState("{not json"), /not valid JSON/);
  assert.throws(() => loadTrackerState(JSON.stringify({ applications: "nope" })), /applications array/);
});

test("all declared statuses are accepted by setStatus", () => {
  const { state, app } = seed();
  for (const status of APPLICATION_STATUSES) {
    setStatus(state, app.id, status, { clock: CLOCK });
    assert.equal(app.status, status);
  }
});
