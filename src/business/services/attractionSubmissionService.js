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
import { isValidPhotoType, isValidPhotoSize } from "@/business/services/photoValidation";

const MIN_SEARCH_INPUT_LENGTH = 2;
const MAX_PHOTOS_PER_SUBMISSION = 6;

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
// category enum, optional photos (count/type/size), duplicate googlePlaceId,
// then fetch authoritative place details, upload any photos, and create the
// record.
//
// Photos are entirely optional — submission must succeed with zero photos,
// same as before this existed. When provided, they're uploaded directly (not
// via a Places photo reference), so they land in `photos` immediately rather
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
  photos: photoFiles = [],
} = {}) {
  const normalizedGooglePlaceId = String(googlePlaceId || "").trim();

  if (!normalizedGooglePlaceId) {
    throw new InvalidSubmissionError("Please select a place from the search results.");
  }

  if (!isValidAttractionCategory(category)) {
    throw new InvalidSubmissionError("Please choose a valid category.");
  }

  if (photoFiles.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new InvalidSubmissionError(`You can upload up to ${MAX_PHOTOS_PER_SUBMISSION} photos.`);
  }

  for (const photo of photoFiles) {
    if (!isValidPhotoType(photo.mimeType)) {
      throw new InvalidSubmissionError("Photos must be JPG, PNG, or WEBP images.");
    }
    if (!isValidPhotoSize(photo.buffer.length)) {
      throw new InvalidSubmissionError("Each photo must be 5MB or smaller.");
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
  for (const [index, photo] of photoFiles.entries()) {
    const photoUrl = await uploadImageFromBuffer(photo.buffer, photo.mimeType, {
      folder: `chatlas/attractions/${normalizedGooglePlaceId}`,
      publicId: `photo-${index + 1}`,
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
