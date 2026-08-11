import { fetchPlaceEditorialSummary } from "@/lib/googlePlaces";
import { updateAttractionDescription } from "@/repositories/attractionRepository";

// Fetches an attraction's description from Google Places (New) editorialSummary.
// Intended to run from scripts/syncAttractionDescriptions.mjs, not from a
// request-serving route — the app never calls Places at page-render time.
export async function syncAttractionDescription(attraction, { placesApiKey, force = false } = {}) {
  if (!force && attraction.description) {
    return { attractionId: attraction._id, name: attraction.name, status: "skipped" };
  }

  if (!attraction.googlePlaceId) {
    return { attractionId: attraction._id, name: attraction.name, status: "no-place-id" };
  }

  const summary = await fetchPlaceEditorialSummary(attraction.googlePlaceId, placesApiKey);

  await updateAttractionDescription(attraction._id, summary);

  return {
    attractionId: attraction._id,
    name: attraction.name,
    status: summary ? "synced" : "no-summary",
  };
}
