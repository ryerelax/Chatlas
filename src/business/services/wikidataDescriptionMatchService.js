import {
  findNearbyWikidataEntities,
  fetchWikipediaExtract,
} from "@/infrastructure/external/wikidata";

// Feasibility investigation (see project notes) found coordinate proximity
// alone picks the wrong nearby POI often enough to be dangerous - e.g. the
// nearest Wikidata entity to "Poh San Teng Temple" is "Malacca Warrior
// Monument" 15m closer. Re-ranking the top few candidates by name similarity
// against distance-only recovers the correct entity and rejects lookalikes
// that would otherwise silently attach a rich, wrong Wikipedia extract.
export const DEFAULT_RADIUS_KM = 0.15;
export const DEFAULT_CANDIDATE_LIMIT = 5;
export const DEFAULT_SIMILARITY_THRESHOLD = 0.45;

// A candidate whose name overlap with our attraction is ONLY a bare category
// word (two different galleries both containing "gallery") can still clear
// the similarity threshold - "Fine Art Gallery" vs "Jehan Chan Art Gallery"
// scores 0.59 despite being two different, unrelated venues. Distance alone
// doesn't separate these from genuine matches either (that wrong match sits
// at 9m). So acceptance additionally requires at least one overlapping token
// that isn't one of these dataset-wide low-discrimination words - UNLESS the
// candidate is within NEAR_CERTAIN_DISTANCE_KM, close enough that proximity
// alone is strong evidence (e.g. "Masjid Tengkera" vs "Tranquerah Mosque" at
// 2m: a genuine historical-spelling match whose only literal token overlap
// is "mosque").
export const NEAR_CERTAIN_DISTANCE_KM = 0.005;

const STOPWORDS = new Set(["a", "an", "the", "of", "at", "in", "and", "&"]);

// Malay/Chinese terms that recur in this dataset's attraction names but
// whose Wikidata/Wikipedia entities are labelled with the English word
// instead (e.g. our "Masjid Tengkera" vs Wikidata's "Tranquerah Mosque").
// Without this, token overlap on genuinely correct matches drops to zero.
const LOCAL_TERM_SYNONYMS = {
  masjid: "mosque",
  kuil: "temple",
  tokong: "temple",
  muzium: "museum",
};

// Bare place-type words - matching on these alone says "both are the same
// kind of thing near each other", not "both are the same thing".
const GENERIC_CATEGORY_WORDS = new Set([
  "mosque",
  "temple",
  "museum",
  "gallery",
  "art",
  "park",
  "fort",
  "church",
  "village",
]);

// Dataset-wide place/name elements so common in Melaka attraction names that
// their overlap carries no more discriminating power than a category word
// (e.g. "Malacca Museum Corporation" vs "Malacca UMNO Museum" share
// "malacca" + "museum" and nothing else; "Masjid Jamek Laksamana Hang Tuah"
// vs "Hang Tuah Village" share "hang" + "tuah", a legendary local hero's
// name that recurs across dozens of unrelated places).
const LOW_DISCRIMINATION_WORDS = new Set(["melaka", "malacca", "hang", "tuah"]);

function isDiscriminatingToken(token) {
  return !GENERIC_CATEGORY_WORDS.has(token) && !LOW_DISCRIMINATION_WORDS.has(token);
}

function normalizeToTokens(text) {
  const withoutParentheticals = text.replace(/\([^)]*\)/g, " ");

  const withSynonyms = withoutParentheticals
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => LOCAL_TERM_SYNONYMS[word] || word)
    .filter((word) => word && !STOPWORDS.has(word));

  return withSynonyms;
}

function diceTokenOverlap(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionSize += 1;
    }
  }

  return (2 * intersectionSize) / (setA.size + setB.size);
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function levenshteinRatio(tokensA, tokensB) {
  const stringA = tokensA.join(" ");
  const stringB = tokensB.join(" ");
  const maxLength = Math.max(stringA.length, stringB.length);
  if (maxLength === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(stringA, stringB) / maxLength;
}

// Exported for the dry-run report, which shows every candidate's score so
// the similarity threshold can be tuned from real output before any write.
export function computeNameSimilarity(nameA, nameB) {
  const tokensA = normalizeToTokens(nameA);
  const tokensB = normalizeToTokens(nameB);

  return Math.max(diceTokenOverlap(tokensA, tokensB), levenshteinRatio(tokensA, tokensB));
}

// True if at least one token appears in both names AND isn't just a shared
// category/place word - see GENERIC_CATEGORY_WORDS / LOW_DISCRIMINATION_WORDS.
function hasDiscriminatingOverlap(nameA, nameB) {
  const tokensB = new Set(normalizeToTokens(nameB));

  return normalizeToTokens(nameA).some((token) => tokensB.has(token) && isDiscriminatingToken(token));
}

function isUnlabeledEntity(label) {
  return !label || /^Q\d+$/.test(label);
}

// Orchestrates the coordinate lookup, name-similarity re-rank, and extract
// fetch for one attraction. Read-only - does not touch the database. Intended
// for scripts/previewWikidataDescriptionMatches.mjs (dry-run) today; a write
// path will be added separately once dry-run matches are reviewed/approved.
export async function findBestWikidataMatch(
  attraction,
  {
    radiusKm = DEFAULT_RADIUS_KM,
    candidateLimit = DEFAULT_CANDIDATE_LIMIT,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
  } = {}
) {
  if (typeof attraction.latitude !== "number" || typeof attraction.longitude !== "number") {
    return { candidates: [], selected: null, verdict: "no-coordinates" };
  }

  const rawCandidates = await findNearbyWikidataEntities(attraction.latitude, attraction.longitude, {
    radiusKm,
    limit: candidateLimit,
  });

  if (rawCandidates.length === 0) {
    return { candidates: [], selected: null, verdict: "no-entities-in-radius" };
  }

  const scoredCandidates = [];
  for (const candidate of rawCandidates) {
    if (isUnlabeledEntity(candidate.label)) {
      scoredCandidates.push({
        ...candidate,
        similarity: 0,
        extract: null,
        extractSource: null,
        rejectReason: "no-english-label",
      });
      continue;
    }

    const similarity = computeNameSimilarity(attraction.name, candidate.label);
    const isNearCertainByDistance =
      candidate.distanceKm != null && candidate.distanceKm <= NEAR_CERTAIN_DISTANCE_KM;
    const discriminatingOverlap = hasDiscriminatingOverlap(attraction.name, candidate.label);

    const wikipediaExtract = candidate.wikipediaUrl
      ? await fetchWikipediaExtract(candidate.wikipediaUrl)
      : null;

    const extract = wikipediaExtract || candidate.wikidataDescription || null;
    const extractSource = wikipediaExtract ? "wikipedia" : candidate.wikidataDescription ? "wikidata-short" : null;

    scoredCandidates.push({
      ...candidate,
      similarity,
      extract,
      extractSource,
      rejectReason:
        similarity < similarityThreshold
          ? "below-similarity-threshold"
          : !discriminatingOverlap && !isNearCertainByDistance
            ? "generic-overlap-only"
            : !extract
              ? "no-usable-description"
              : null,
    });
  }

  const eligible = scoredCandidates
    .filter((candidate) => candidate.rejectReason === null)
    .sort((a, b) => b.similarity - a.similarity);

  if (eligible.length === 0) {
    return { candidates: scoredCandidates, selected: null, verdict: "no-eligible-match" };
  }

  return { candidates: scoredCandidates, selected: eligible[0], verdict: "matched" };
}
