# Data Model

This is a starting model for discussion, not an implementation contract.

## Resume Profile

- `id`
- `owner`
- `sourceFile`
- `createdAt`
- `updatedAt`
- `sections`
- `skills`
- `experience`
- `education`
- `certifications`
- `projects`
- `claims`

## Job Posting

- `id`
- `source`
- `url`
- `capturedAt`
- `company`
- `title`
- `location`
- `compensation`
- `requirements`
- `niceToHaves`
- `responsibilities`
- `signals`

## Tailoring Run

- `id`
- `resumeId`
- `jobPostingId`
- `createdAt`
- `fitSummary`
- `gaps`
- `suggestedEdits`
- `draftOutputs`
- `sourceNotes`
- `reviewStatus`

## Application Record

- `id`
- `company`
- `roleTitle`
- `jobPostingId`
- `status`
- `appliedAt`
- `followUpAt`
- `contacts`
- `notes`
- `artifacts`

## Privacy Notes

Resume source files, personal notes, job-search state, and run outputs should remain uncommitted unless explicitly sanitized.
Persisted review metadata should stay on basename, byte length, input format, and SHA-256 digest only; private source-relative or absolute paths should not be written into reports.
