import { ATTRACTION_CATEGORIES } from "@/business/services/attractionCategories";

// Fallback for attractions the Wikidata coordinate-match backfill couldn't
// cover (see wikidataDescriptionMatchService.js / feasibility notes) - a
// short, honest sentence built only from fields already verified on the
// record (category, locationArea). Never invents facts about the specific
// place, unlike the Wikidata/Places-sourced descriptions.
const CATEGORY_PHRASES = {
  Museum: { article: "a", noun: "museum" },
  Religious: { article: "a", noun: "religious site" },
  "Tourist Attraction": { article: "a", noun: "tourist attraction" },
  Historical: { article: "a", noun: "historical site" },
  Nature: { article: "a", noun: "nature spot" },
  Entertainment: { article: "an", noun: "entertainment venue" },
  Gallery: { article: "an", noun: "art gallery" },
};

const FALLBACK_PHRASE = { article: "an", noun: "attraction" };

export function buildGenericDescription({ category, locationArea }) {
  const phrase = CATEGORY_PHRASES[category] || FALLBACK_PHRASE;
  const location = locationArea && locationArea.trim() ? `${locationArea.trim()}, Melaka` : "Melaka";

  return `${phrase.article.charAt(0).toUpperCase()}${phrase.article.slice(1)} ${phrase.noun} located in ${location}.`;
}

// Every ATTRACTION_CATEGORIES value must have a phrase - a missing one would
// silently fall back to generic "an attraction" text instead of failing loudly.
export function hasPhraseForAllCategories() {
  return ATTRACTION_CATEGORIES.every((category) => Boolean(CATEGORY_PHRASES[category]));
}
