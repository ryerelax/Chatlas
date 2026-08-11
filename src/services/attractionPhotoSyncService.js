import { fetchPlacePhotoUrls } from "@/lib/googlePlaces";
import { uploadImageFromUrl } from "@/lib/cloudinary";
import { updateAttractionPhotos } from "@/repositories/attractionRepository";

const PHOTOS_PER_ATTRACTION = 6;

// Fetches an attraction's photos from Google Places (New) and re-hosts them on
// Cloudinary so the app never calls the Places Photo API at render time. Intended
// to run from scripts/syncAttractionPhotos.mjs, not from a request-serving route.
export async function syncAttractionPhotos(attraction, { placesApiKey, force = false } = {}) {
  if (!force && attraction.photos && attraction.photos.length > 0) {
    return { attractionId: attraction._id, name: attraction.name, status: "skipped" };
  }

  if (!attraction.googlePlaceId) {
    return { attractionId: attraction._id, name: attraction.name, status: "no-place-id" };
  }

  const photoUrls = await fetchPlacePhotoUrls(attraction.googlePlaceId, {
    apiKey: placesApiKey,
    maxPhotos: PHOTOS_PER_ATTRACTION,
  });

  if (photoUrls.length === 0) {
    return { attractionId: attraction._id, name: attraction.name, status: "no-photos" };
  }

  const uploadedUrls = [];
  for (const [index, photoUrl] of photoUrls.entries()) {
    const secureUrl = await uploadImageFromUrl(photoUrl, {
      folder: `chatlas/attractions/${attraction._id}`,
      publicId: `photo-${index + 1}`,
    });
    uploadedUrls.push(secureUrl);
  }

  await updateAttractionPhotos(attraction._id, uploadedUrls);

  return {
    attractionId: attraction._id,
    name: attraction.name,
    status: "synced",
    photoCount: uploadedUrls.length,
  };
}
