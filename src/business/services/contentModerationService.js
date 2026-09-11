import { Filter } from "bad-words";

const filter = new Filter();

// Keyword-based check, shared by every free-text user input field
// (attraction descriptions, reviews, review comments, profile bio).
// TODO: Extend coverage beyond English — "bad-words" only ships an
// English blocklist, so Chinese and Bahasa Melayu profanity currently
// pass through unfiltered. Revisit with a multi-language list or a
// moderation API if that becomes a real problem.
export function containsProfanity(text) {
  if (typeof text !== "string" || !text.trim()) {
    return false;
  }

  return filter.isProfane(text);
}
