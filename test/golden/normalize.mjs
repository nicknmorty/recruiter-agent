// Shared helpers to stabilize golden-fixture comparisons.
//
// Review output contains volatile fields that change every run (timestamps,
// per-file SHA-256 digests, byte lengths). Golden tests normalize these to
// fixed placeholders so that only intentional output-shape changes cause a diff.

const PLACEHOLDER_TIMESTAMP = "<generatedAt>";
const PLACEHOLDER_SHA256 = "<sha256>";
const PLACEHOLDER_BYTES = "<byteLength>";

// Normalize a parsed JSON review object in place-free fashion (returns a copy).
export function normalizeReviewJson(review) {
  const copy = JSON.parse(JSON.stringify(review));
  if (typeof copy.generatedAt === "string") {
    copy.generatedAt = PLACEHOLDER_TIMESTAMP;
  }
  if (copy.run?.inputs) {
    for (const key of ["resume", "job", "notes"]) {
      const input = copy.run.inputs[key];
      if (input && typeof input === "object") {
        if (typeof input.sha256 === "string") input.sha256 = PLACEHOLDER_SHA256;
        if (typeof input.byteLength === "number") input.byteLength = PLACEHOLDER_BYTES;
      }
    }
  }
  return copy;
}

// Normalize a rendered text report by replacing volatile substrings.
export function normalizeReviewText(text) {
  return text
    .replace(/SHA-256: [a-f0-9]{64}/g, `SHA-256: ${PLACEHOLDER_SHA256}`)
    .replace(/"generatedAt":\s*"[^"]*"/g, `"generatedAt": "${PLACEHOLDER_TIMESTAMP}"`);
}

export function stableJsonString(review) {
  return `${JSON.stringify(normalizeReviewJson(review), null, 2)}\n`;
}
