import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { findAttractionById } from "@/data/repositories/attractionRepository";
import {
  createReview,
  findReviewsByAttraction,
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

    return await createReview({
      attractionId: normalizedAttractionId,
      userId: user._id,
      userName: user.displayName || user.name,
      userAvatar: user.profilePicture || "",
      rating: normalizedRating,
      reviewText: normalizedReviewText,
      photos: uploadedPhotos,
    });
  } catch (error) {
    await rollbackUploadedPhotos(uploadedPhotos);
    throw error;
  }
}

export async function getReviewsByAttraction(attractionId) {
  const normalizedAttractionId = attractionId?.trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    return null;
  }

  return findReviewsByAttraction(normalizedAttractionId);
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

// Update Review Function
export async function updateReview({
  reviewId,
  userId,
  email,
  rating,
  reviewText,
  photoFiles = [],
  deletePhotoPublicIds = [],
}) {
  const normalizedReviewId = reviewId?.trim();
  const normalizedUserId = userId?.toString();
  const normalizedRating = normalizeRating(rating);
  const normalizedReviewText = normalizeReviewText(reviewText);
  const normalizedPhotoFiles = validateReviewPhotos(photoFiles);
  const normalizedDeletePhotoPublicIds = Array.isArray(deletePhotoPublicIds)
    ? deletePhotoPublicIds.filter((id) => typeof id === "string" && id.trim())
    : [];

  if (!mongoose.Types.ObjectId.isValid(normalizedReviewId)) {
    throw new ReviewServiceError("Invalid review ID.", 400);
  }

  // Find the review
  const Review = mongoose.model("Review");
  const review = await Review.findById(normalizedReviewId);
  
  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  // Find the user by email
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ReviewServiceError("User not found.", 404);
  }

  // Check ownership - support both ObjectId and String (Google UUID)
  const isOwner = 
    review.userId === user.googleId || 
    review.userId.toString() === user._id.toString();

  if (!isOwner) {
    throw new ReviewServiceError("You can only edit your own reviews.", 403);
  }

  // Update basic fields
  review.rating = normalizedRating;
  review.reviewText = normalizedReviewText;

  // Handle photo deletion
  if (normalizedDeletePhotoPublicIds.length > 0) {
    // Delete from Cloudinary
    for (const publicId of normalizedDeletePhotoPublicIds) {
      try {
        await deleteImageByPublicId(publicId);
      } catch (err) {
        console.error(`Failed to delete photo ${publicId}:`, err);
        // Continue with other photos even if one fails
      }
    }
    // Remove from review
    review.photos = review.photos.filter(
      (p) => !normalizedDeletePhotoPublicIds.includes(p.publicId)
    );
  }

  // Handle new photo uploads
  const uploadedPhotos = [];
  if (normalizedPhotoFiles.length > 0) {
    const maxPhotos = 3;
    const currentCount = review.photos.length;
    const remainingSlots = maxPhotos - currentCount;
    
    if (remainingSlots <= 0) {
      throw new ReviewServiceError(
        `Maximum ${maxPhotos} photos allowed per review.`,
        400
      );
    }

    const filesToUpload = normalizedPhotoFiles.slice(0, remainingSlots);

    try {
      for (const photoFile of filesToUpload) {
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

      // Add uploaded photos to review
      review.photos.push(...uploadedPhotos);
    } catch (error) {
      // Rollback uploaded photos if any fail
      await rollbackUploadedPhotos(uploadedPhotos);
      throw error;
    }
  }

  await review.save();

  // Return populated review
  return await review.populate("attractionId", "name category address rating photos");
}