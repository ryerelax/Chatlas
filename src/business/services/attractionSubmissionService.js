import {
  searchPlacesAutocomplete,
  fetchPlaceDetailsForSubmission,
} from "@/infrastructure/external/googlePlaces";
import { uploadImageFromBuffer } from "@/infrastructure/external/cloudinary";
import {
  findActiveAttractionByGooglePlaceId,
  createAttraction,
} from "@/data/repositories/attractionRepository";
import { isValidAttractionCategory } from "@/business/services/attractionCategories";
import { classifyLocationArea } from "@/business/services/locationAreas";

const MIN_SEARCH_INPUT_LENGTH = 2;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

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
// category enum, optional photo (type/size), duplicate googlePlaceId, then
// fetch authoritative place details, upload the photo if provided, and
// create the record.
//
// The photo is entirely optional — submission must succeed with zero photos,
// same as before this existed. When provided, it's uploaded directly (not
// via a Places photo reference), so it lands in `photos` immediately rather
// than waiting on the offline sync scripts. Once at least one photo exists,
// sync:photos's own skip condition (an empty/missing `photos` array) already
// leaves it alone on default runs — see the Decision 4 photo-upload
// investigation for the one narrow exception (--force).
export async function submitAttraction({
  googlePlaceId,
  category,
  sessionToken,
  session,
  apiKey,
  photoBuffer,
  photoMimeType,
} = {}) {
  const normalizedGooglePlaceId = String(googlePlaceId || "").trim();

  if (!normalizedGooglePlaceId) {
    throw new InvalidSubmissionError("Please select a place from the search results.");
  }

  if (!isValidAttractionCategory(category)) {
    throw new InvalidSubmissionError("Please choose a valid category.");
  }

  if (photoBuffer) {
    if (!ALLOWED_PHOTO_TYPES.includes(photoMimeType)) {
      throw new InvalidSubmissionError("Photo must be a JPG, PNG, or WEBP image.");
    }
    if (photoBuffer.length > MAX_PHOTO_SIZE_BYTES) {
      throw new InvalidSubmissionError("Photo is too large. Maximum size is 5MB.");
    }
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

  const photos = [];
  if (photoBuffer) {
    const photoUrl = await uploadImageFromBuffer(photoBuffer, photoMimeType, {
      folder: `chatlas/attractions/${normalizedGooglePlaceId}`,
      publicId: "photo-1",
    });
    photos.push(photoUrl);
  }

  return createAttraction({
    ...placeDetails,
    category,
    locationArea,
    photos,
    submittedBy: {
      googleId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  });
}
