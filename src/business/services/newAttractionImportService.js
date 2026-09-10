import { fetchPlaceEditorialSummary } from "@/infrastructure/external/googlePlaces";
import { classifyLocationArea } from "@/business/services/locationAreas";
import { classifyAttractionCategory } from "@/business/services/attractionCategoryClassifier";
import { buildGenericDescription } from "@/business/services/genericDescriptionService";
import { syncAttractionPhotos } from "@/business/services/attractionPhotoSyncService";
import {
  createAttraction,
  updateAttractionDescription,
  updateAttractionDescriptionGeneric,
} from "@/data/repositories/attractionRepository";

// Bulk import for the STEP 2 new-attraction investigation's approved
// candidates. Runs each one through the same enrichment pipeline as the
// original seed and Decision 4's live submission flow: classify location
// area, sync photos from Places into Cloudinary, then description via the
// established priority - Places editorialSummary first, generic
// category+area template if the place has none. No submittedBy (this isn't
// a user submission, same as the original seed).
export async function importAttractionCandidate(candidate, { placesApiKey }) {
  const category = classifyAttractionCategory(candidate.types);
  const locationArea = classifyLocationArea(candidate.address, candidate.name);

  const attraction = await createAttraction({
    googlePlaceId: candidate.googlePlaceId,
    name: candidate.name,
    address: candidate.address,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    types: candidate.types,
    rating: candidate.rating,
    totalReviews: candidate.totalReviews,
    businessStatus: candidate.businessStatus,
    googleMapsUrl: candidate.googleMapsUrl,
    source: "Google Places API New",
    category,
    locationArea,
  });

  const photoResult = await syncAttractionPhotos(attraction, { placesApiKey });

  const editorialSummary = await fetchPlaceEditorialSummary(candidate.googlePlaceId, placesApiKey);

  let descriptionSource;
  if (editorialSummary) {
    await updateAttractionDescription(attraction._id, editorialSummary);
    descriptionSource = "places";
  } else {
    const generic = buildGenericDescription({ category, locationArea });
    await updateAttractionDescriptionGeneric(attraction._id, generic);
    descriptionSource = "generic";
  }

  return {
    attractionId: attraction._id,
    name: attraction.name,
    category,
    locationArea,
    photoStatus: photoResult.status,
    descriptionSource,
  };
}
