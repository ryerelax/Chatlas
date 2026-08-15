import mongoose from "mongoose";
import { findAttractionById } from "@/data/repositories/attractionRepository";
import {
  createReview,
  findReviewsByAttraction,
} from "@/data/repositories/reviewRepository";
import { findUserByEmail } from "@/data/repositories/userRepository";

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
}) {
  const normalizedAttractionId = normalizeAttractionId(attractionId);
  const normalizedRating = normalizeRating(rating);
  const normalizedReviewText = normalizeReviewText(reviewText);
  const normalizedEmail = typeof email === "string" ? email.trim() : "";

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

  return createReview({
    attractionId: normalizedAttractionId,
    userId: user._id,
    userName: user.displayName || user.name,
    userAvatar: user.profilePicture || "",
    rating: normalizedRating,
    reviewText: normalizedReviewText,
  });
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
