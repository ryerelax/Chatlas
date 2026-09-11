import mongoose from "mongoose";
import {
  deleteImageByPublicId,
  uploadImageWithMetadataFromBuffer,
} from "@/infrastructure/external/cloudinary";
import {
  addAttractionPhoto,
  findAttractionById,
} from "@/data/repositories/attractionRepository";
import { moderateUploadedImageFile } from "@/business/services/imageModerationService";
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
  photoFile,
}) {
  if (!isMelakaBasedUser(session)) {
    throw new LocationNotAllowedError("Available to Melaka-based users.");
  }

  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  const attraction = await findAttractionById(attractionId);
  if (!attraction) {
    throw new AttractionNotFoundError("Attraction not found.");
  }

  const approvedPhoto = await moderateUploadedImageFile(photoFile);

  // Keep every public ID unique so a contribution can never replace another
  // community photo and failed persistence can clean up only this upload.
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadedPhoto = await uploadImageWithMetadataFromBuffer(
    approvedPhoto.buffer,
    approvedPhoto.mimeType,
    {
      folder: `chatlas/attractions/${attractionId}`,
      publicId: `community-${uniqueSuffix}`,
    }
  );

  try {
    const updatedAttraction = await addAttractionPhoto(
      attractionId,
      uploadedPhoto.url
    );

    if (!updatedAttraction) {
      throw new AttractionNotFoundError("Attraction not found.");
    }

    return updatedAttraction;
  } catch (error) {
    await Promise.allSettled([
      deleteImageByPublicId(uploadedPhoto.publicId),
    ]);
    throw error;
  }
}
