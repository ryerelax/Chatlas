import { ATTRACTION_CATEGORIES } from "@/business/services/attractionCategories";

// Bulk-import category classifier for scripts/importNewAttractions.mjs -
// Decision 4's Add Attraction flow has a human pick the category, so this
// didn't exist before. Rules and their priority order were reverse-engineered
// from how the original ~123-attraction seed was actually categorised (e.g.
// "Poh San Teng Temple" has "tourist_attraction" as its first Google type but
// is Religious; "Malacca Submarine Museum" likewise leads with
// tourist_attraction but is Museum) - so this checks for a specific type
// marker anywhere in the array, not just position 0, and only falls back to
// "Tourist Attraction" when nothing more specific matches.
const CATEGORY_TYPE_RULES = [
  {
    category: "Religious",
    types: [
      "place_of_worship",
      "mosque",
      "hindu_temple",
      "buddhist_temple",
      "church",
      "synagogue",
    ],
  },
  { category: "Museum", types: ["museum"] },
  { category: "Gallery", types: ["art_gallery"] },
  {
    category: "Historical",
    types: ["historical_landmark", "historical_place", "monument"],
  },
  {
    category: "Entertainment",
    types: [
      "amusement_park",
      "water_park",
      "zoo",
      "aquarium",
      "amusement_center",
      "event_venue",
      "movie_theater",
      "bowling_alley",
    ],
  },
  {
    category: "Nature",
    types: [
      "park",
      "beach",
      "natural_feature",
      "hiking_area",
      "nature_preserve",
      "national_park",
      "garden",
    ],
  },
];

const FALLBACK_CATEGORY = "Tourist Attraction";

export function classifyAttractionCategory(types = []) {
  const typeSet = new Set(types);

  for (const rule of CATEGORY_TYPE_RULES) {
    if (rule.types.some((type) => typeSet.has(type))) {
      return rule.category;
    }
  }

  return FALLBACK_CATEGORY;
}

// Every rule's category must be a real enum value - a typo here would
// silently create attractions with an invalid category.
export function hasValidCategoryRules() {
  return CATEGORY_TYPE_RULES.every((rule) => ATTRACTION_CATEGORIES.includes(rule.category));
}
