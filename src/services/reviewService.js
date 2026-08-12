import mongoose from "mongoose";
import {
  createReview,
  findReviewsByAttraction,
} from "@/repositories/reviewRepository";

/**
 * Create a new review
 */
export async function submitReview(reviewData) {
  const { rating, reviewText } = reviewData;

  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  // Validate review text
  if (!reviewText || reviewText.trim() === "") {
    throw new Error("Review text is required.");
  }

  return createReview(reviewData);
}

/**
 * Get reviews for an attraction
 */
export async function getReviewsByAttraction(attractionId) {
  const normalizedAttractionId = attractionId?.trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    return null;
  }

  return findReviewsByAttraction(normalizedAttractionId);
}
