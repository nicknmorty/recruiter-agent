import { describe, expect, it } from "vitest";
import entry, { splitArgs, isAllowedCommand, ALLOWED_COMMANDS } from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";

describe("recruiter-agent-tool", () => {
  it("declares the recruiter tool", () => {
    expect(getToolPluginMetadata(entry)?.tools.map((tool) => tool.name)).toEqual(["recruiter"]);
  });

  it("splits args while preserving quoted values", () => {
    expect(splitArgs('track add --company "Acme Corp" --role Analyst')).toEqual([
      "track",
      "add",
      "--company",
      "Acme Corp",
      "--role",
      "Analyst",
    ]);
  });

  it("allows only recruiter-agent verbs (default status)", () => {
    for (const cmd of ALLOWED_COMMANDS) expect(isAllowedCommand(cmd)).toBe(true);
    expect(isAllowedCommand(undefined)).toBe(true); // defaults to status
  });

  it("blocks arbitrary commands", () => {
    expect(isAllowedCommand("rm")).toBe(false);
    expect(isAllowedCommand("node")).toBe(false);
    expect(isAllowedCommand("sh")).toBe(false);
  });
});
