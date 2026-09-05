// Confirmed attraction category enum. Shared by the AttractionList filter
// dropdown and Decision 4's Add Attraction submission validation, so there is
// exactly one source of truth for what counts as a valid category.
export const ATTRACTION_CATEGORIES = [
  "Museum",
  "Religious",
  "Tourist Attraction",
  "Historical",
  "Nature",
  "Entertainment",
  "Gallery",
];

export function isValidAttractionCategory(category) {
  return ATTRACTION_CATEGORIES.includes(category);
}
