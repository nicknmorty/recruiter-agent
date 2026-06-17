import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

const execFileAsync = promisify(execFile);

// Deterministic tool wrapper around the local recruiter-agent CLI. This lets a
// skill use `command-dispatch: tool` so `/recruiter <args>` runs the CLI
// directly with no model in the loop. The CLI itself is offline, makes no
// network calls, and takes no external actions.
//
// Allowed leading subcommands are restricted so the tool cannot be steered into
// arbitrary execution; only the recruiter-agent verbs are permitted.
export const ALLOWED_COMMANDS = new Set([
  "status",
  "review",
  "research",
  "bottom-feeder",
  "track",
  "help",
  "--help",
  "-h",
]);

// Minimal shell-free arg splitter: supports single/double quotes so values like
// --company "Acme Corp" survive. No shell is ever invoked.
export function splitArgs(raw: string): string[] {
  const args: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return args;
}

export function isAllowedCommand(command: string | undefined): boolean {
  const value = command ?? "status";
  return ALLOWED_COMMANDS.has(value);
}

export default defineToolPlugin({
  id: "recruiter-agent-tool",
  name: "Recruiter Agent Tool",
  description: "Run the local deterministic recruiter-agent CLI (resume review, job-fit, research, application tracking). No external actions.",
  configSchema: Type.Object({
    cliPath: Type.Optional(
      Type.String({
        description:
          "Absolute path to recruiter-agent bin/recruiter-agent.mjs. Defaults to ~/projects/active/recruiter-agent/bin/recruiter-agent.mjs.",
      }),
    ),
  }),
  tools: (tool) => [
    tool({
      name: "recruiter",
      label: "Recruiter Agent",
      description:
        "Run a recruiter-agent CLI command. The args string is the full command, e.g. 'track list' or 'review --resume /path/r.txt --job /path/j.txt'. Deterministic, local-only, no external actions.",
      parameters: Type.Object({
        args: Type.String({
          description:
            "Full recruiter-agent CLI arguments, e.g. 'track list', 'track add --company Acme --role \"Data Analyst\"', or 'review --resume <path> --job <path>'.",
        }),
      }),
      execute: async ({ args }, config) => {
        const cliPath =
          (config?.cliPath as string | undefined) ||
          `${process.env.HOME ?? ""}/projects/active/recruiter-agent/bin/recruiter-agent.mjs`;
        const parsed = splitArgs(String(args ?? "").trim());
        const command = parsed[0] ?? "status";
        if (!isAllowedCommand(command)) {
          return {
            ok: false,
            error: `Unsupported recruiter-agent command: ${command}. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}.`,
          };
        }
        try {
          const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...parsed], {
            encoding: "utf8",
            maxBuffer: 20 * 1024 * 1024,
            timeout: 30000,
          });
          return { ok: true, command, output: stdout, stderr: stderr || null };
        } catch (error: unknown) {
          const e = error as { message?: string; stdout?: string; stderr?: string };
          return {
            ok: false,
            command,
            error: e?.message ?? "recruiter-agent failed",
            output: e?.stdout ?? null,
            stderr: e?.stderr ?? null,
          };
        }
      },
    }),
  ],
});
