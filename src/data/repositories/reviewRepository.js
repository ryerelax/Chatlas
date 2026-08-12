import Review from "@/data/models/Review";

/**
 * Create a new review
 * @param {Object} reviewData - The data for the new review
 * @returns {Promise<Object>} - The created review document
 */
export async function createReview(reviewData) {
  const review = await Review.create(reviewData);
  return review.toObject();
}

/**
 * Find reviews by attraction ID
 * @param {string} attractionId - The ID of the attraction
 * @returns {Promise<Array>} - An array of reviews for the specified attraction
 */
export async function findReviewsByAttraction(attractionId) {
  return Review.find({
    attractionId,
  })
    .sort({ createdAt: -1 })      /** Sort by creation date, newest first */
    .lean();
}
