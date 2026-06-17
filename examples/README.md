# Example Scenarios

These examples are sanitized and fictional. They are meant for legitimate local
testing before using private resume, job-search, or application data.

## Support Automation Scenario

```bash
npm run smoke

node bin/recruiter-agent.mjs review \
  --resume examples/support-automation/resume.txt \
  --job examples/support-automation/job-posting.txt \
  --notes examples/support-automation/notes.txt

node bin/recruiter-agent.mjs research \
  --job examples/support-automation/job-posting.txt \
  --resume examples/support-automation/resume.txt \
  --notes examples/support-automation/notes.txt \
  --topic company \
  --citation-template \
  --out runs/examples

node bin/recruiter-agent.mjs research \
  --job examples/support-automation/job-posting.txt \
  --resume examples/support-automation/resume.txt \
  --notes examples/support-automation/notes.txt \
  --topic company \
  --citations examples/support-automation/citations.json
```

Use `--out runs/examples` for local artifacts. `runs/` and `state/` are
gitignored, so generated reports and tracker state stay out of the repository.
