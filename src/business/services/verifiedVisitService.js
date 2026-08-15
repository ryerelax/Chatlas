import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  calculateDistanceMetres,
  createMalaysiaVisitDateKey,
  MAX_VISIT_DISTANCE_METRES,
  validateGeolocationEvidence,
} from "@/business/services/visitVerificationRules";
import { findAttractionById } from "@/data/repositories/attractionRepository";
import { findUserByGoogleId } from "@/data/repositories/userRepository";
import {
  appendPhotoToDatedVisit,
  deleteVisitWhenEmpty,
  findDistinctVerifiedAttractionIds,
  findPublicVerifiedPhotos as findPublicVerifiedPhotosRepository,
  removeOwnedPhoto,
} from "@/data/repositories/verifiedVisitRepository";
import {
  deleteCloudinaryImage,
  uploadVerifiedVisitImage,
} from "@/infrastructure/external/cloudinary";

export class VerifiedVisitServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "VerifiedVisitServiceError";
    this.statusCode = statusCode;
  }
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const INVALID_IMAGE_MESSAGE = "A JPEG, PNG, or WebP image up to 5 MiB is required.";
const SAVE_ERROR_MESSAGE = "Unable to save the verified visit photo.";
const DELETE_ERROR_MESSAGE = "Unable to delete the verified visit photo.";

function requireProviderSubject(googleId) {
  if (typeof googleId !== "string" || googleId.trim().length === 0) {
    throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
  }

  return googleId.trim();
}

function requireObjectId(value, label, isValidObjectId) {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new VerifiedVisitServiceError(`A valid ${label} ID is required.`, 400);
  }

  return value;
}

function validateImageDataUri(photoDataUri) {
  if (typeof photoDataUri !== "string") {
    throw new VerifiedVisitServiceError(INVALID_IMAGE_MESSAGE, 400);
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoDataUri);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1])) {
    throw new VerifiedVisitServiceError(INVALID_IMAGE_MESSAGE, 400);
  }

  const encoded = match[2];
  if (encoded.length % 4 !== 0) {
    throw new VerifiedVisitServiceError(INVALID_IMAGE_MESSAGE, 400);
  }

  const decoded = Buffer.from(encoded, "base64");
  const canonicalInput = encoded.replace(/=+$/, "");
  const canonicalDecoded = decoded.toString("base64").replace(/=+$/, "");
  if (
    decoded.length === 0
    || decoded.length > MAX_IMAGE_BYTES
    || canonicalDecoded !== canonicalInput
  ) {
    throw new VerifiedVisitServiceError(INVALID_IMAGE_MESSAGE, 400);
  }

  return photoDataUri;
}

function validateEvidence(input) {
  try {
    return validateGeolocationEvidence(input);
  } catch (error) {
    throw new VerifiedVisitServiceError(error.message, 400);
  }
}

function safeString(value) {
  return value?.toString?.() ?? "";
}

function toIsoString(value) {
  return new Date(value).toISOString();
}

function toSafeCreatedPhoto(visit, attractionId, capturedAt) {
  const photo = visit?.photos?.at(-1);
  if (!visit?._id || !photo?._id || !photo?.photoUrl) {
    throw new Error("The persisted visit did not include the created photo.");
  }

  return {
    visitId: safeString(visit._id),
    photoId: safeString(photo._id),
    attractionId: safeString(attractionId),
    photoUrl: photo.photoUrl,
    capturedDate: capturedAt.toISOString(),
    verified: true,
  };
}

function toSafePublicCards(visits, attractionId) {
  return visits
    .flatMap((visit) => (visit.photos || []).map((photo) => ({
      visitId: safeString(visit._id),
      photoId: safeString(photo._id),
      attractionId: safeString(attractionId),
      photoUrl: photo.photoUrl,
      capturedDate: toIsoString(photo.capturedAt),
      user: {
        displayName: visit.user?.displayName || visit.user?.name || "Chatlas user",
        avatarUrl: visit.user?.profilePicture || "",
      },
      verified: true,
      canDelete: Boolean(visit.canDelete),
    })))
    .sort((first, second) => (
      new Date(second.capturedDate).getTime() - new Date(first.capturedDate).getTime()
    ));
}

function asSafeInternalError(message) {
  return new VerifiedVisitServiceError(message, 500);
}

export function createVerifiedVisitService(dependencies) {
  const {
    isValidObjectId,
    now,
    randomUUID: createUuid,
    findUserByGoogleId: findUser,
    findAttractionById: findAttraction,
    uploadVerifiedVisitImage: uploadImage,
    deleteCloudinaryImage: deleteImage,
    appendPhotoToDatedVisit: appendPhoto,
    findDistinctVerifiedAttractionIds: findDistinctIds,
    findPublicVerifiedPhotos: findPublicPhotos,
    removeOwnedPhoto,
    deleteVisitWhenEmpty: deleteEmptyVisit,
  } = dependencies;

  async function findPersistedUser(googleId, errorMessage) {
    try {
      return await findUser(googleId);
    } catch {
      throw asSafeInternalError(errorMessage);
    }
  }

  async function verifyVisitPhoto(input = {}) {
    const googleId = requireProviderSubject(input.googleId);
    const attractionId = requireObjectId(input.attractionId, "attraction", isValidObjectId);
    const photoDataUri = validateImageDataUri(input.photoDataUri);
    const evidence = validateEvidence(input);
    const user = await findPersistedUser(googleId, SAVE_ERROR_MESSAGE);

    if (!user?._id) {
      throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
    }

    let attraction;
    try {
      attraction = await findAttraction(attractionId);
    } catch {
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }

    if (!attraction?._id) {
      throw new VerifiedVisitServiceError("Attraction not found.", 404);
    }

    const distanceMeters = calculateDistanceMetres(evidence, attraction);
    if (!Number.isFinite(distanceMeters)) {
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }
    if (distanceMeters > MAX_VISIT_DISTANCE_METRES) {
      throw new VerifiedVisitServiceError(
        "You must be within 150 metres of the attraction to verify this visit.",
        400
      );
    }

    const capturedAt = now();
    const visitDateKey = createMalaysiaVisitDateKey(capturedAt);
    const publicId = [
      safeString(user._id),
      safeString(attraction._id),
      visitDateKey,
      capturedAt.getTime(),
      createUuid(),
    ].join("-");

    let uploaded;
    try {
      uploaded = await uploadImage(photoDataUri, { publicId });
    } catch {
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }

    if (!uploaded?.photoUrl || !uploaded?.cloudinaryPublicId) {
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }

    let cleanupAttempted = false;
    const cleanupUpload = async () => {
      if (cleanupAttempted) return;
      cleanupAttempted = true;
      await deleteImage(uploaded.cloudinaryPublicId);
    };

    try {
      const visit = await appendPhoto({
        userId: user._id,
        attractionId: attraction._id,
        visitDateKey,
        photo: {
          photoUrl: uploaded.photoUrl,
          cloudinaryPublicId: uploaded.cloudinaryPublicId,
          capturedAt,
          latitude: evidence.latitude,
          longitude: evidence.longitude,
          accuracyMeters: evidence.accuracyMeters,
          distanceMeters,
        },
      });

      if (!visit) {
        await cleanupUpload();
        throw new VerifiedVisitServiceError(
          "You have already added 3 verified photos for this attraction today. You can add more photos on your next visit.",
          409
        );
      }

      return toSafeCreatedPhoto(visit, attraction._id, capturedAt);
    } catch (error) {
      if (error instanceof VerifiedVisitServiceError) {
        throw error;
      }

      try {
        await cleanupUpload();
      } catch {
        // The response remains safe and cleanup is never attempted more than once.
      }
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }
  }

  async function getVerifiedAttractionIdsForUser(providerSubject) {
    const googleId = requireProviderSubject(providerSubject);
    const user = await findPersistedUser(googleId, "Unable to load verified visits.");
    if (!user?._id) return [];

    try {
      const ids = await findDistinctIds(user._id);
      return [...new Set(ids.map(safeString).filter(Boolean))];
    } catch {
      throw asSafeInternalError("Unable to load verified visits.");
    }
  }

  async function getPublicVerifiedPhotos(attractionIdInput, optionalGoogleId) {
    const attractionId = requireObjectId(attractionIdInput, "attraction", isValidObjectId);
    let viewerId;

    if (optionalGoogleId !== undefined && optionalGoogleId !== null) {
      const googleId = requireProviderSubject(optionalGoogleId);
      const user = await findPersistedUser(googleId, "Unable to load verified visit photos.");
      viewerId = user?._id;
    }

    try {
      const visits = await findPublicPhotos(attractionId, viewerId);
      return toSafePublicCards(visits, attractionId);
    } catch (error) {
      if (error instanceof VerifiedVisitServiceError) throw error;
      throw asSafeInternalError("Unable to load verified visit photos.");
    }
  }

  async function deleteOwnedVerifiedPhoto({ googleId: providerSubject, visitId: visitIdInput, photoId: photoIdInput } = {}) {
    const googleId = requireProviderSubject(providerSubject);
    const visitId = requireObjectId(visitIdInput, "visit", isValidObjectId);
    const photoId = requireObjectId(photoIdInput, "photo", isValidObjectId);
    const user = await findPersistedUser(googleId, DELETE_ERROR_MESSAGE);

    if (!user?._id) {
      throw new VerifiedVisitServiceError(
        "You can only delete your own verified photos.",
        403
      );
    }

    let removal;
    try {
      removal = await removeOwnedPhoto({ userId: user._id, visitId, photoId });
    } catch {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    if (!removal) {
      throw new VerifiedVisitServiceError(
        "You can only delete your own verified photos.",
        403
      );
    }

    const cloudinaryPublicId = removal.removedPhoto?.cloudinaryPublicId;
    if (!cloudinaryPublicId) {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    try {
      await deleteImage(cloudinaryPublicId);
      if (removal.visit?.photos?.length === 0) {
        await deleteEmptyVisit(visitId);
      }
    } catch {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }
  }

  return {
    verifyVisitPhoto,
    getVerifiedAttractionIdsForUser,
    getPublicVerifiedPhotos,
    deleteOwnedVerifiedPhoto,
  };
}

const verifiedVisitService = createVerifiedVisitService({
  isValidObjectId: mongoose.isValidObjectId,
  now: () => new Date(),
  randomUUID,
  findUserByGoogleId,
  findAttractionById,
  uploadVerifiedVisitImage,
  deleteCloudinaryImage,
  appendPhotoToDatedVisit,
  findDistinctVerifiedAttractionIds,
  findPublicVerifiedPhotos: findPublicVerifiedPhotosRepository,
  removeOwnedPhoto,
  deleteVisitWhenEmpty,
});

export async function verifyVisitPhoto(input) {
  return verifiedVisitService.verifyVisitPhoto(input);
}

export async function getVerifiedAttractionIdsForUser(googleId) {
  return verifiedVisitService.getVerifiedAttractionIdsForUser(googleId);
}

export async function getPublicVerifiedPhotos(attractionId, optionalGoogleId) {
  return verifiedVisitService.getPublicVerifiedPhotos(attractionId, optionalGoogleId);
}

export async function deleteOwnedVerifiedPhoto(input) {
  return verifiedVisitService.deleteOwnedVerifiedPhoto(input);
}
