// Shared description length constraint, used by both the community
// description-editing feature (existing attractions, Melaka-gated) and the
// optional description field on Add Attraction submission (new attractions,
// not location-gated) — same cap for consistency.
export const MAX_DESCRIPTION_LENGTH = 2000;

export function isValidDescriptionLength(text) {
  return text.length <= MAX_DESCRIPTION_LENGTH;
}
