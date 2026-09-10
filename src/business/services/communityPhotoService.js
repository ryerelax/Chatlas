import mongoose from "mongoose";
import { uploadImageFromBuffer } from "@/infrastructure/external/cloudinary";
import { addAttractionPhoto } from "@/data/repositories/attractionRepository";
import { isValidPhotoType, isValidPhotoSize } from "@/business/services/photoValidation";
import { isMelakaBasedUser } from "@/business/services/locationGate";

// Any Melaka-based logged-in user can add one photo to any existing active
// attraction (not just ones they submitted) — separate feature from the
// Reviews module; doesn't touch or depend on its components/schema.
// Direct, no approval queue, consistent with the rest of this project's
// no-admin-workflow additions.
export class LocationNotAllowedError extends Error {}
export class InvalidPhotoError extends Error {}
export class AttractionNotFoundError extends Error {}

export async function addCommunityPhoto({
  attractionId,
  session,
  photoBuffer,
  photoMimeType,
}) {
  if (!isMelakaBasedUser(session)) {
    throw new LocationNotAllowedError("Available to Melaka-based users.");
  }

  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  if (!photoBuffer || photoBuffer.length === 0) {
    throw new InvalidPhotoError("Please choose a photo to upload.");
  }

  if (!isValidPhotoType(photoMimeType)) {
    throw new InvalidPhotoError("Photo must be a JPG, PNG, or WEBP image.");
  }

  if (!isValidPhotoSize(photoBuffer.length)) {
    throw new InvalidPhotoError("Photo is too large. Maximum size is 5MB.");
  }

  // uploadImageFromBuffer's Cloudinary call uses overwrite: true, so publicId
  // must be unique per upload — otherwise a second community photo would
  // silently replace the first instead of adding to the array.
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const photoUrl = await uploadImageFromBuffer(photoBuffer, photoMimeType, {
    folder: `chatlas/attractions/${attractionId}`,
    publicId: `community-${uniqueSuffix}`,
  });

  const updatedAttraction = await addAttractionPhoto(attractionId, photoUrl);

  if (!updatedAttraction) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  return updatedAttraction;
}
