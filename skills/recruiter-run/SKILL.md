---
name: recruiter-run
description: Run the recruiter-agent CLI deterministically (no model). e.g. /recruiter-run track list. Requires the recruiter-agent-tool plugin.
user-invocable: true
command-dispatch: tool
command-tool: recruiter
command-arg-mode: raw
---

# Recruiter Agent (deterministic dispatch)

This skill routes `/recruiter-run <args>` directly to the `recruiter` tool
provided by the `recruiter-agent-tool` plugin, with no model in the loop. The
raw argument string is forwarded verbatim as the CLI command.

Examples:

```text
/recruiter-run track list
/recruiter-run track due --on 2026-06-10
/recruiter-run track add --company Acme --role "Data Analyst" --due 2026-06-10
/recruiter-run review --resume /path/resume.txt --job /path/job.txt
/recruiter-run research --job /path/job.txt --topic company
```

Requires the `recruiter-agent-tool` plugin to be installed and enabled. Until
then, use the model-routed `/recruiter` skill instead. The underlying CLI is
deterministic, local-only, and takes no external actions.
