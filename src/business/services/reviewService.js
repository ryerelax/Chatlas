import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { findAttractionById } from "@/data/repositories/attractionRepository";
import {
  addReviewLike,
  createReview,
  deleteReviewById,
  findReviewById,
  findReviewByIdWithAttraction,
  findReviewsByAttraction,
  findReviewsByUserId,
  removeReviewPhotoByPublicId,
  removeReviewLike,
  updateReviewById,
} from "@/data/repositories/reviewRepository";
import { findUserByEmail } from "@/data/repositories/userRepository";
import {
  deleteImageByPublicId,
  uploadImageWithMetadataFromBuffer,
} from "@/infrastructure/external/cloudinary";
import {
  isValidPhotoSize,
  isValidPhotoType,
} from "@/business/services/photoValidation";

const MAX_REVIEW_PHOTOS = 3;

export class ReviewServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ReviewServiceError";
    this.statusCode = statusCode;
  }
}

export async function submitReview({
  attractionId,
  email,
  rating,
  reviewText,
  photoFiles = [],
}) {
  const normalizedAttractionId = normalizeAttractionId(attractionId);
  const normalizedRating = normalizeRating(rating);
  const normalizedReviewText = normalizeReviewText(reviewText);
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedPhotoFiles = validateReviewPhotos(photoFiles);

  if (!normalizedEmail) {
    throw new ReviewServiceError("User account not found.", 404);
  }

  const [attraction, user] = await Promise.all([
    findAttractionById(normalizedAttractionId),
    findUserByEmail(normalizedEmail),
  ]);

  if (!attraction) {
    throw new ReviewServiceError("Attraction not found.", 404);
  }

  if (!user) {
    throw new ReviewServiceError("User account not found.", 404);
  }

  const uploadedPhotos = [];

  try {
    for (const photoFile of normalizedPhotoFiles) {
      const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
      const uploadedPhoto = await uploadImageWithMetadataFromBuffer(
        photoBuffer,
        photoFile.type,
        {
          folder: `chatlas/reviews/${normalizedAttractionId}`,
          publicId: `review-${randomUUID()}`,
        }
      );

      uploadedPhotos.push(uploadedPhoto);
    }

    const review = await createReview({
      attractionId: normalizedAttractionId,
      userId: user._id,
      userName: user.displayName || user.name,
      userAvatar: user.profilePicture || "",
      rating: normalizedRating,
      reviewText: normalizedReviewText,
      photos: uploadedPhotos,
    });

    return serializeReviewForViewer(review, user._id);
  } catch (error) {
    await rollbackUploadedPhotos(uploadedPhotos);
    throw error;
  }
}

export async function getReviewsByAttraction(attractionId, email = "") {
  const normalizedAttractionId = attractionId?.trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    return null;
  }

  const [reviews, viewer] = await Promise.all([
    findReviewsByAttraction(normalizedAttractionId),
    findOptionalUserByEmail(email),
  ]);

  return reviews.map((review) =>
    serializeReviewForViewer(review, viewer?._id)
  );
}

function normalizeAttractionId(attractionId) {
  const normalizedAttractionId =
    typeof attractionId === "string" ? attractionId.trim() : "";

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    throw new ReviewServiceError("A valid attraction id is required.", 400);
  }

  return normalizedAttractionId;
}

function normalizeRating(rating) {
  if (rating === undefined || rating === null || rating === "") {
    throw new ReviewServiceError("Rating is required.", 400);
  }

  const normalizedRating = Number(rating);

  if (
    !Number.isInteger(normalizedRating) ||
    normalizedRating < 1 ||
    normalizedRating > 5
  ) {
    throw new ReviewServiceError("Rating must be an integer from 1 to 5.", 400);
  }

  return normalizedRating;
}

function normalizeReviewText(reviewText) {
  if (typeof reviewText !== "string" || !reviewText.trim()) {
    throw new ReviewServiceError("Review text is required.", 400);
  }

  const normalizedReviewText = reviewText.trim();

  if (normalizedReviewText.length > 1000) {
    throw new ReviewServiceError(
      "Review text must be 1,000 characters or fewer.",
      400
    );
  }

  return normalizedReviewText;
}

function validateReviewPhotos(photoFiles) {
  if (!Array.isArray(photoFiles)) {
    throw new ReviewServiceError("Invalid review photos.", 400);
  }

  if (photoFiles.length > MAX_REVIEW_PHOTOS) {
    throw new ReviewServiceError(
      `A review can include up to ${MAX_REVIEW_PHOTOS} photos.`,
      400
    );
  }

  for (const photoFile of photoFiles) {
    if (
      !photoFile ||
      typeof photoFile !== "object" ||
      typeof photoFile.arrayBuffer !== "function" ||
      !Number.isFinite(photoFile.size) ||
      photoFile.size <= 0
    ) {
      throw new ReviewServiceError("Each photo must contain an image.", 400);
    }

    if (!isValidPhotoType(photoFile.type)) {
      throw new ReviewServiceError(
        "Photos must be JPG, PNG, or WebP images.",
        400
      );
    }

    if (!isValidPhotoSize(photoFile.size)) {
      throw new ReviewServiceError(
        "Each photo must be 5 MB or smaller.",
        400
      );
    }
  }

  return photoFiles;
}

async function rollbackUploadedPhotos(uploadedPhotos) {
  await Promise.allSettled(
    uploadedPhotos.map((photo) => deleteImageByPublicId(photo.publicId))
  );
}

export async function getReviewById(reviewId, email = "") {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const [review, viewer] = await Promise.all([
    findReviewByIdWithAttraction(normalizedReviewId),
    findOptionalUserByEmail(email),
  ]);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  return serializeReviewForViewer(review, viewer?._id);
}

export async function getReviewsByAuthenticatedUser(email) {
  const user = await resolveUserByEmail(email);
  const reviews = await findReviewsByUserId(user._id);

  return reviews.map((review) => serializeReviewForViewer(review, user._id));
}

export async function updateReview({
  reviewId,
  email,
  rating,
  reviewText,
  photoFiles = [],
  deletePhotoPublicIds = [],
}) {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const normalizedRating = normalizeRating(rating);
  const normalizedReviewText = normalizeReviewText(reviewText);
  const normalizedPhotoFiles = validateReviewPhotos(photoFiles);
  const normalizedDeletePhotoPublicIds = normalizePhotoPublicIds(
    deletePhotoPublicIds
  );
  const [review, user] = await Promise.all([
    findReviewById(normalizedReviewId),
    resolveUserByEmail(email),
  ]);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  assertReviewOwnership(review, user, "edit");

  const existingPhotos = getReviewPhotos(review.photos);
  const existingPublicIds = new Set(
    existingPhotos.map((photo) => photo.publicId)
  );

  if (
    normalizedDeletePhotoPublicIds.some(
      (publicId) => !existingPublicIds.has(publicId)
    )
  ) {
    throw new ReviewServiceError(
      "One or more selected photos were not found.",
      400
    );
  }

  const deletedPublicIdSet = new Set(normalizedDeletePhotoPublicIds);
  const retainedPhotos = existingPhotos.filter(
    (photo) => !deletedPublicIdSet.has(photo.publicId)
  );

  if (retainedPhotos.length + normalizedPhotoFiles.length > MAX_REVIEW_PHOTOS) {
    throw new ReviewServiceError(
      `A review can include up to ${MAX_REVIEW_PHOTOS} photos.`,
      400
    );
  }

  const uploadedPhotos = [];

  try {
    for (const photoFile of normalizedPhotoFiles) {
      const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
      const uploadedPhoto = await uploadImageWithMetadataFromBuffer(
        photoBuffer,
        photoFile.type,
        {
          folder: `chatlas/reviews/${review.attractionId}`,
          publicId: `review-${randomUUID()}`,
        }
      );
      uploadedPhotos.push(uploadedPhoto);
    }

    const updatedReview = await updateReviewById(normalizedReviewId, {
      rating: normalizedRating,
      reviewText: normalizedReviewText,
      photos: [...retainedPhotos, ...uploadedPhotos],
    });

    if (!updatedReview) {
      throw new ReviewServiceError("Review not found.", 404);
    }

    await deleteCloudinaryPhotos(normalizedDeletePhotoPublicIds);
    return serializeReviewForViewer(updatedReview, user._id);
  } catch (error) {
    await rollbackUploadedPhotos(uploadedPhotos);
    throw error;
  }
}

export async function deleteReview({ reviewId, email }) {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const [review, user] = await Promise.all([
    findReviewById(normalizedReviewId),
    resolveUserByEmail(email),
  ]);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  assertReviewOwnership(review, user, "delete");

  const deletedReview = await deleteReviewById(normalizedReviewId);

  if (!deletedReview) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  await deleteCloudinaryPhotos(
    getReviewPhotos(review.photos).map((photo) => photo.publicId)
  );

  return deletedReview;
}

export async function deleteReviewPhoto({ reviewId, email, publicId }) {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const normalizedPublicId =
    typeof publicId === "string" ? publicId.trim() : "";

  if (!normalizedPublicId) {
    throw new ReviewServiceError("Public ID is required.", 400);
  }

  const [review, user] = await Promise.all([
    findReviewById(normalizedReviewId),
    resolveUserByEmail(email),
  ]);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  assertReviewOwnership(review, user, "delete photos from");

  const photo = getReviewPhotos(review.photos).find(
    (item) => item.publicId === normalizedPublicId
  );

  if (!photo) {
    throw new ReviewServiceError("Photo not found in review.", 404);
  }

  const updatedReview = await removeReviewPhotoByPublicId(
    normalizedReviewId,
    normalizedPublicId
  );

  if (!updatedReview) {
    throw new ReviewServiceError("Photo not found in review.", 404);
  }

  await deleteCloudinaryPhotos([normalizedPublicId]);
  return updatedReview;
}

export async function likeReview({ reviewId, email }) {
  return setReviewLikeState({ reviewId, email, liked: true });
}

export async function unlikeReview({ reviewId, email }) {
  return setReviewLikeState({ reviewId, email, liked: false });
}

async function setReviewLikeState({ reviewId, email, liked }) {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const user = await resolveUserByEmail(email);
  const review = liked
    ? await addReviewLike(normalizedReviewId, user._id)
    : await removeReviewLike(normalizedReviewId, user._id);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  return serializeReviewLikeState(review, user._id);
}

function normalizeReviewId(reviewId) {
  const normalizedReviewId =
    typeof reviewId === "string" ? reviewId.trim() : "";

  if (!mongoose.Types.ObjectId.isValid(normalizedReviewId)) {
    throw new ReviewServiceError("Invalid review ID.", 400);
  }

  return normalizedReviewId;
}

async function resolveUserByEmail(email) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";

  if (!normalizedEmail) {
    throw new ReviewServiceError("User account not found.", 404);
  }

  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    throw new ReviewServiceError("User account not found.", 404);
  }

  return user;
}

async function findOptionalUserByEmail(email) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";

  if (!normalizedEmail) {
    return null;
  }

  return findUserByEmail(normalizedEmail);
}

function assertReviewOwnership(review, user, action) {
  if (review.userId?.toString() !== user._id.toString()) {
    throw new ReviewServiceError(
      `You can only ${action} your own reviews.`,
      403
    );
  }
}

function normalizePhotoPublicIds(publicIds) {
  if (!Array.isArray(publicIds)) {
    throw new ReviewServiceError("Invalid photo deletion request.", 400);
  }

  return [
    ...new Set(
      publicIds
        .filter((publicId) => typeof publicId === "string")
        .map((publicId) => publicId.trim())
        .filter(Boolean)
    ),
  ];
}

function getReviewPhotos(photos) {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos.filter(
    (photo) =>
      photo &&
      typeof photo.url === "string" &&
      photo.url.trim() &&
      typeof photo.publicId === "string" &&
      photo.publicId.trim()
  );
}

async function deleteCloudinaryPhotos(publicIds) {
  if (publicIds.length === 0) {
    return;
  }

  const results = await Promise.allSettled(
    publicIds.map((publicId) => deleteImageByPublicId(publicId))
  );

  if (results.some((result) => result.status === "rejected")) {
    console.error("One or more Review photo cleanup operations failed.");
  }
}

function serializeReviewForViewer(review, viewerId = null) {
  const publicReview = { ...review };
  delete publicReview.likes;

  return {
    ...publicReview,
    ...createReviewLikeState(review, viewerId),
  };
}

function serializeReviewLikeState(review, viewerId) {
  return {
    reviewId: review._id.toString(),
    ...createReviewLikeState(review, viewerId),
  };
}

function createReviewLikeState(review, viewerId = null) {
  const uniqueLikeIds = new Set(
    (Array.isArray(review.likes) ? review.likes : [])
      .map((like) => like?._id ?? like)
      .map((likeId) => likeId?.toString())
      .filter(Boolean)
  );
  const normalizedViewerId = viewerId?.toString() || "";

  return {
    likeCount: uniqueLikeIds.size,
    likedByCurrentUser:
      Boolean(normalizedViewerId) && uniqueLikeIds.has(normalizedViewerId),
  };
}
