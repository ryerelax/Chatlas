import {
  searchPlacesAutocomplete,
  fetchPlaceDetailsForSubmission,
} from "@/infrastructure/external/googlePlaces";
import {
  findActiveAttractionByGooglePlaceId,
  createAttraction,
} from "@/data/repositories/attractionRepository";
import { isValidAttractionCategory } from "@/business/services/attractionCategories";
import { classifyLocationArea } from "@/business/services/locationAreas";

const MIN_SEARCH_INPUT_LENGTH = 2;

export class InvalidSubmissionError extends Error {}
export class DuplicateAttractionError extends Error {}

// Decision 4: Places-selection-only search, proxied through the server-side
// GOOGLE_PLACES_API_KEY. sessionToken must be the same value across every
// keystroke of one search (and the eventual submitAttraction call) so Google
// bills the whole journey as a single session.
export async function searchPlaces(input, { sessionToken, apiKey } = {}) {
  const normalizedInput = String(input || "").trim();

  if (normalizedInput.length < MIN_SEARCH_INPUT_LENGTH) {
    return [];
  }

  return searchPlacesAutocomplete(normalizedInput, { apiKey, sessionToken });
}

// Decision 4: Registered-User self-service submission. Publishes immediately
// on success — no admin review queue. Validation order: required fields,
// category enum, duplicate googlePlaceId, then fetch authoritative place
// details and create the record.
export async function submitAttraction({
  googlePlaceId,
  category,
  sessionToken,
  session,
  apiKey,
} = {}) {
  const normalizedGooglePlaceId = String(googlePlaceId || "").trim();

  if (!normalizedGooglePlaceId) {
    throw new InvalidSubmissionError("Please select a place from the search results.");
  }

  if (!isValidAttractionCategory(category)) {
    throw new InvalidSubmissionError("Please choose a valid category.");
  }

  const existing = await findActiveAttractionByGooglePlaceId(normalizedGooglePlaceId);
  if (existing) {
    throw new DuplicateAttractionError("This place has already been added to Chatlas.");
  }

  const placeDetails = await fetchPlaceDetailsForSubmission(normalizedGooglePlaceId, {
    apiKey,
    sessionToken,
  });

  const locationArea = classifyLocationArea(placeDetails.address, placeDetails.name);

  return createAttraction({
    ...placeDetails,
    category,
    locationArea,
    submittedBy: {
      googleId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  });
}
