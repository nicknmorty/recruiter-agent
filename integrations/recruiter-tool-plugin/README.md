# Recruiter Agent Tool

OpenClaw tool plugin that exposes the local, deterministic `recruiter-agent`
CLI as a single `recruiter` tool. Pairs with the `recruiter-run` skill
(`command-dispatch: tool`) so `/recruiter-run <args>` runs the CLI with no
model in the loop.

The tool shells `recruiter-agent` (offline, no network, no external actions)
and restricts the leading subcommand to the recruiter-agent verbs
(`status`, `review`, `research`, `bottom-feeder`, `track`, `help`). It never
invokes a shell.

## Config

Optional `cliPath` overrides the CLI location. Default:
`~/projects/active/recruiter-agent/bin/recruiter-agent.mjs`.

## Build / validate / test

```bash
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

## Install into OpenClaw (owner-only; restarts managed Gateways)

```bash
openclaw plugins install ./integrations/recruiter-tool-plugin
openclaw plugins enable recruiter-agent-tool
```

Then `/recruiter-run track list` dispatches straight to the tool. Until the
plugin is installed, use the model-routed `/recruiter` skill instead.
