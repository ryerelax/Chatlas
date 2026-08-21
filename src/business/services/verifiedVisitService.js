import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import {
  createMalaysiaVisitDateKey,
  evaluateVisitProximity,
  MAX_PHOTOS_PER_ATTRACTION_DAY,
  normaliseVerifiedVisitSubmissionKey,
  validateGeolocationEvidence,
} from "@/business/services/visitVerificationRules";
import { findAttractionByIdForVerifiedVisit } from "@/data/repositories/attractionRepository";
import { findUserByGoogleId } from "@/data/repositories/userRepository";
import {
  appendPhotosToDatedVisit,
  deleteVisitWhenEmpty,
  findDatedVisitBySubmissionKey,
  findDatedVisitPhotoCount,
  findDistinctVerifiedAttractionIds,
  findOwnedPhotoForDeletion,
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
const MAX_ENCODED_IMAGE_CHARS = 4 * Math.ceil(MAX_IMAGE_BYTES / 3);
const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const INVALID_IMAGE_MESSAGE = "A JPEG, PNG, or WebP image up to 5 MiB is required.";
const SAVE_ERROR_MESSAGE = "Unable to save the verified visit photo.";
const DELETE_ERROR_MESSAGE = "Unable to delete the verified visit photo.";
const INVALID_BATCH_MESSAGE = "Add exactly one verified visit photo.";
const CAPACITY_MESSAGE =
  "You have already verified this attraction today. You can add a new photo on another Malaysia date.";

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
  if (encoded.length > MAX_ENCODED_IMAGE_CHARS || encoded.length % 4 !== 0) {
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

function validateImageBatch(photoDataUris) {
  if (
    !Array.isArray(photoDataUris)
    || photoDataUris.length !== MAX_PHOTOS_PER_ATTRACTION_DAY
  ) {
    throw new VerifiedVisitServiceError(INVALID_BATCH_MESSAGE, 400);
  }

  return photoDataUris.map(validateImageDataUri);
}

function validateEvidence(input) {
  const normaliseNumber = (value, message) => {
    const isNumber = typeof value === "number" && Number.isFinite(value);
    const isNumericString = typeof value === "string"
      && value.trim().length > 0
      && Number.isFinite(Number(value));

    if (!isNumber && !isNumericString) {
      throw new VerifiedVisitServiceError(message, 400);
    }

    return Number(value);
  };

  const evidence = {
    latitude: normaliseNumber(input.latitude, "A valid current location is required."),
    longitude: normaliseNumber(input.longitude, "A valid current location is required."),
    accuracyMeters: normaliseNumber(
      input.accuracyMeters,
      "A valid location accuracy is required."
    ),
  };

  try {
    return validateGeolocationEvidence(evidence);
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

function toSafeCreatedBatch(visit, attractionId, capturedAt, incomingPhotoCount) {
  const createdPhotos = visit?.photos?.slice(-incomingPhotoCount).map((photo) => {
    if (!photo?._id || !photo?.photoUrl) {
      throw new Error("The persisted visit did not include every created photo.");
    }

    return {
      photoId: safeString(photo._id),
      photoUrl: photo.photoUrl,
      capturedDate: capturedAt.toISOString(),
      verified: true,
    };
  });
  const firstPhoto = createdPhotos?.[0];

  if (!visit?._id || createdPhotos?.length !== incomingPhotoCount || !firstPhoto) {
    throw new Error("The persisted visit did not include every created photo.");
  }

  return {
    visitId: safeString(visit._id),
    photoId: firstPhoto.photoId,
    attractionId: safeString(attractionId),
    photoUrl: firstPhoto.photoUrl,
    capturedDate: firstPhoto.capturedDate,
    verified: true,
    photos: createdPhotos,
  };
}

function toSafeReplayedBatch(visit, attractionId) {
  const createdPhotos = visit?.photos?.map((photo) => {
    if (!photo?._id || !photo?.photoUrl || !photo?.capturedAt) {
      throw new Error("The replayed visit did not include every created photo.");
    }

    return {
      photoId: safeString(photo._id),
      photoUrl: photo.photoUrl,
      capturedDate: toIsoString(photo.capturedAt),
      verified: true,
    };
  });
  const firstPhoto = createdPhotos?.[0];

  if (!visit?._id || !firstPhoto) {
    throw new Error("The replayed visit did not include every created photo.");
  }

  return {
    visitId: safeString(visit._id),
    photoId: firstPhoto.photoId,
    attractionId: safeString(attractionId),
    photoUrl: firstPhoto.photoUrl,
    capturedDate: firstPhoto.capturedDate,
    verified: true,
    photos: createdPhotos,
  };
}

function replayMatchesUploadedBatch(visit, uploadedAssets) {
  if (
    !Array.isArray(visit?.photos)
    || visit.photos.length !== uploadedAssets.length
  ) {
    return false;
  }

  return visit.photos.every((photo, index) => (
    typeof photo?.photoUrl === "string"
    && photo.photoUrl === uploadedAssets[index]?.photoUrl
  ));
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
    findAttractionByIdForVerifiedVisit: findAttraction,
    uploadVerifiedVisitImage: uploadImage,
    deleteCloudinaryImage: deleteImage,
    appendPhotosToDatedVisit: appendPhotos,
    findDatedVisitBySubmissionKey: findBySubmissionKey,
    findDatedVisitPhotoCount: findPhotoCount,
    findDistinctVerifiedAttractionIds: findDistinctIds,
    findPublicVerifiedPhotos: findPublicPhotos,
    findOwnedPhotoForDeletion: findOwnedPhoto,
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

  async function findSupportedAttraction(attractionId, errorMessage) {
    let attraction;
    try {
      attraction = await findAttraction(attractionId);
    } catch {
      throw asSafeInternalError(errorMessage);
    }

    if (
      !attraction?._id
      || attraction.isActive !== true
      || attraction.state !== "Melaka"
    ) {
      throw new VerifiedVisitServiceError("Attraction not found.", 404);
    }

    return attraction;
  }

  async function readDatedPhotoCount(input, errorMessage) {
    let count;
    try {
      count = await findPhotoCount(input);
    } catch {
      throw asSafeInternalError(errorMessage);
    }

    if (!Number.isInteger(count) || count < 0) {
      throw asSafeInternalError(errorMessage);
    }

    return count;
  }

  async function readSubmissionReplay(input, errorMessage) {
    try {
      return await findBySubmissionKey(input);
    } catch {
      throw asSafeInternalError(errorMessage);
    }
  }

  async function verifyVisitPhotos(input = {}) {
    const googleId = requireProviderSubject(input.googleId);
    const attractionId = requireObjectId(input.attractionId, "attraction", isValidObjectId);
    const photoDataUris = validateImageBatch(input.photoDataUris);
    const evidence = validateEvidence(input);
    let submissionKey;
    try {
      submissionKey = normaliseVerifiedVisitSubmissionKey(input.submissionKey);
    } catch (error) {
      throw new VerifiedVisitServiceError(error.message, 400);
    }
    const user = await findPersistedUser(googleId, SAVE_ERROR_MESSAGE);

    if (!user?._id) {
      throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
    }

    const attraction = await findSupportedAttraction(attractionId, SAVE_ERROR_MESSAGE);
    const capturedAt = now();
    const visitDateKey = createMalaysiaVisitDateKey(capturedAt);
    const datedVisitInput = {
      userId: user._id,
      attractionId: attraction._id,
      visitDateKey,
    };
    const submissionReplayInput = submissionKey
      ? {
          userId: user._id,
          attractionId: attraction._id,
          submissionKey,
        }
      : null;

    if (submissionKey) {
      const replayedVisit = await readSubmissionReplay(
        submissionReplayInput,
        SAVE_ERROR_MESSAGE
      );
      if (replayedVisit) {
        return toSafeReplayedBatch(replayedVisit, attraction._id);
      }
    }

    const {
      distanceMetres: distanceMeters,
      radiusMeters,
      qualifies,
    } = evaluateVisitProximity(attraction, evidence);
    if (!Number.isFinite(distanceMeters)) {
      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }
    if (!qualifies) {
      throw new VerifiedVisitServiceError(
        `You must be within ${radiusMeters} metres of the attraction to verify this visit.`,
        400
      );
    }

    const existingPhotoCount = await readDatedPhotoCount(
      datedVisitInput,
      SAVE_ERROR_MESSAGE
    );
    if (existingPhotoCount + photoDataUris.length > MAX_PHOTOS_PER_ATTRACTION_DAY) {
      throw new VerifiedVisitServiceError(CAPACITY_MESSAGE, 409);
    }

    const uploadedAssets = [];
    let cleanupAttempted = false;
    let preserveUploadedAssets = false;
    const cleanupUploads = async () => {
      if (cleanupAttempted) return;
      cleanupAttempted = true;

      for (const asset of uploadedAssets) {
        if (!asset.cloudinaryPublicId) continue;
        try {
          await deleteImage(asset.cloudinaryPublicId);
        } catch {
          // Cleanup is best effort, and every remaining asset is still attempted.
        }
      }
    };

    try {
      for (const photoDataUri of photoDataUris) {
        const uploaded = await uploadImage(photoDataUri, { publicId: createUuid() });
        if (uploaded?.cloudinaryPublicId) {
          uploadedAssets.push(uploaded);
        }
        if (!uploaded?.photoUrl || !uploaded?.cloudinaryPublicId) {
          throw asSafeInternalError(SAVE_ERROR_MESSAGE);
        }
      }

      const photos = uploadedAssets.map((uploaded) => ({
          photoUrl: uploaded.photoUrl,
          cloudinaryPublicId: uploaded.cloudinaryPublicId,
          capturedAt,
          latitude: evidence.latitude,
          longitude: evidence.longitude,
          accuracyMeters: evidence.accuracyMeters,
          distanceMeters,
      }));
      const appendInput = {
        ...datedVisitInput,
        photos,
        ...(submissionKey ? { submissionKey } : {}),
      };
      let visit;
      try {
        visit = await appendPhotos(appendInput);
      } catch (appendError) {
        if (!submissionKey) throw appendError;

        let retryReturnedNull = false;
        try {
          visit = await appendPhotos(appendInput);
          retryReturnedNull = visit === null;
        } catch {
          // A second unknown outcome must be reconciled before destructive cleanup.
        }

        if (visit) {
          preserveUploadedAssets = true;
          return toSafeCreatedBatch(
            visit,
            attraction._id,
            capturedAt,
            photos.length
          );
        }

        let replayedVisit;
        try {
          replayedVisit = await readSubmissionReplay(
            submissionReplayInput,
            SAVE_ERROR_MESSAGE
          );
        } catch (reconciliationError) {
          preserveUploadedAssets = true;
          throw reconciliationError;
        }

        if (replayedVisit) {
          if (replayMatchesUploadedBatch(replayedVisit, uploadedAssets)) {
            preserveUploadedAssets = true;
          } else {
            await cleanupUploads();
          }
          return toSafeReplayedBatch(replayedVisit, attraction._id);
        }

        if (!retryReturnedNull) {
          preserveUploadedAssets = true;
          throw asSafeInternalError(SAVE_ERROR_MESSAGE);
        }
        throw appendError;
      }

      if (!visit) {
        if (submissionKey) {
          const replayedVisit = await readSubmissionReplay(
            submissionReplayInput,
            SAVE_ERROR_MESSAGE
          );
          if (replayedVisit) {
            await cleanupUploads();
            return toSafeReplayedBatch(replayedVisit, attraction._id);
          }
        }
        throw new VerifiedVisitServiceError(CAPACITY_MESSAGE, 409);
      }

      return toSafeCreatedBatch(visit, attraction._id, capturedAt, photos.length);
    } catch (error) {
      if (!preserveUploadedAssets) {
        await cleanupUploads();
      }
      if (error instanceof VerifiedVisitServiceError) {
        throw error;
      }

      throw asSafeInternalError(SAVE_ERROR_MESSAGE);
    }
  }

  async function verifyVisitPhoto(input = {}) {
    const { photoDataUri, ...batchInput } = input;
    const result = await verifyVisitPhotos({
      ...batchInput,
      photoDataUris: [photoDataUri],
    });
    return {
      visitId: result.visitId,
      photoId: result.photoId,
      attractionId: result.attractionId,
      photoUrl: result.photoUrl,
      capturedDate: result.capturedDate,
      verified: result.verified,
    };
  }

  async function getVerifiedVisitPhotoCapacity(input = {}) {
    const googleId = requireProviderSubject(input.googleId);
    const attractionId = requireObjectId(input.attractionId, "attraction", isValidObjectId);
    const user = await findPersistedUser(
      googleId,
      "Unable to load verified visit photo capacity."
    );

    if (!user?._id) {
      throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
    }

    const attraction = await findSupportedAttraction(
      attractionId,
      "Unable to load verified visit photo capacity."
    );
    const visitDateKey = createMalaysiaVisitDateKey(now());
    const existingTodayCount = await readDatedPhotoCount(
      { userId: user._id, attractionId: attraction._id, visitDateKey },
      "Unable to load verified visit photo capacity."
    );

    return {
      attractionId: safeString(attraction._id),
      existingTodayCount,
      dailyLimit: MAX_PHOTOS_PER_ATTRACTION_DAY,
      remainingSlots: existingTodayCount === 0 ? 1 : 0,
    };
  }

  async function getVerifiedAttractionIdsForUser(providerSubject) {
    const googleId = requireProviderSubject(providerSubject);
    const user = await findPersistedUser(googleId, "Unable to load verified visits.");
    if (!user?._id) {
      throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
    }

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

    const ownershipInput = { userId: user._id, visitId, photoId };
    let ownedPhoto;
    try {
      ownedPhoto = await findOwnedPhoto(ownershipInput);
    } catch {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    if (!ownedPhoto) {
      throw new VerifiedVisitServiceError(
        "You can only delete your own verified photos.",
        403
      );
    }

    const cloudinaryPublicId = ownedPhoto.cloudinaryPublicId;
    if (!cloudinaryPublicId) {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    try {
      await deleteImage(cloudinaryPublicId);
    } catch {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    let visit;
    try {
      visit = await removeOwnedPhoto(ownershipInput);
    } catch {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    if (!visit) {
      throw asSafeInternalError(DELETE_ERROR_MESSAGE);
    }

    if (visit.photos?.length === 0) {
      try {
        await deleteEmptyVisit(visitId);
      } catch {
        // The photo and its external asset are gone; an empty group is safe to retain.
      }
    }
  }

  return {
    verifyVisitPhotos,
    verifyVisitPhoto,
    getVerifiedVisitPhotoCapacity,
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
  findAttractionByIdForVerifiedVisit,
  uploadVerifiedVisitImage,
  deleteCloudinaryImage,
  appendPhotosToDatedVisit,
  findDatedVisitBySubmissionKey,
  findDatedVisitPhotoCount,
  findDistinctVerifiedAttractionIds,
  findPublicVerifiedPhotos: findPublicVerifiedPhotosRepository,
  findOwnedPhotoForDeletion,
  removeOwnedPhoto,
  deleteVisitWhenEmpty,
});

export async function verifyVisitPhoto(input) {
  return verifiedVisitService.verifyVisitPhoto(input);
}

export async function verifyVisitPhotos(input) {
  return verifiedVisitService.verifyVisitPhotos(input);
}

export async function getVerifiedVisitPhotoCapacity(input) {
  return verifiedVisitService.getVerifiedVisitPhotoCapacity(input);
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
