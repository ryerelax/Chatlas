const BLOCKED_TAXONOMY_NAMES = new Set([
  "explicit nudity",
  "explicit sexual activity",
  "sex toys",
  "non-explicit nudity",
  "obstructed intimate parts",
  "violence",
  "weapons",
  "graphic violence",
  "physical violence",
  "self-harm",
  "blood & gore",
  "visually disturbing",
  "drugs & tobacco",
  "alcohol",
  "rude gestures",
  "middle finger",
  "gambling",
  "hate symbols",
]);

function normalizeTaxonomyName(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLowerCase()
    : "";
}

function isTaxonomyLevel(value) {
  return Number.isInteger(value) && value >= 1 && value <= 3;
}

export function isBlockedModerationLabel(label, rejectConfidence) {
  const confidence = Number(label?.Confidence);
  const taxonomyLevel = Number(label?.TaxonomyLevel);

  if (
    !Number.isFinite(confidence) ||
    confidence < rejectConfidence
  ) {
    return false;
  }

  const name = normalizeTaxonomyName(label?.Name);
  const parentName = normalizeTaxonomyName(label?.ParentName);

  if (BLOCKED_TAXONOMY_NAMES.has(name)) return true;

  // A child of a blocked L1/L2 category is also blocked. Parent matching is
  // deliberately exact and only applies below L1, so unrelated labels such
  // as the separate "Swimwear or Underwear" category remain allowed.
  return (
    isTaxonomyLevel(taxonomyLevel) &&
    taxonomyLevel > 1 &&
    BLOCKED_TAXONOMY_NAMES.has(parentName)
  );
}

export function evaluateChildSafeImagePolicy(
  labels,
  { rejectConfidence = 70 } = {}
) {
  const normalizedLabels = Array.isArray(labels) ? labels : [];
  return {
    approved: !normalizedLabels.some((label) =>
      isBlockedModerationLabel(label, rejectConfidence)
    ),
  };
}
