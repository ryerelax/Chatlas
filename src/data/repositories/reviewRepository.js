import Review from "@/data/models/Review";

const PUBLIC_REVIEW_FIELDS =
  "_id attractionId rating reviewText photos createdAt";

export function createPublicReviewRepository({ ReviewModel }) {
  return {
    async findPublicReviewsByUserId(userId) {
      return ReviewModel.find({ userId })
        .select(PUBLIC_REVIEW_FIELDS)
        .populate("attractionId", "_id name")
        .sort({ createdAt: -1, _id: -1 })
        .lean();
    },

    async findReviewedAttractionIdsByUserId(userId) {
      return ReviewModel.distinct("attractionId", { userId });
    },
  };
}

const publicReviewRepository = createPublicReviewRepository({
  ReviewModel: Review,
});

export async function findPublicReviewsByUserId(userId) {
  return publicReviewRepository.findPublicReviewsByUserId(userId);
}

export async function findReviewedAttractionIdsByUserId(userId) {
  return publicReviewRepository.findReviewedAttractionIdsByUserId(userId);
}

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

export async function findReviewById(reviewId) {
  return Review.findById(reviewId).lean();
}

export async function findReviewByIdWithAttraction(reviewId) {
  return Review.findById(reviewId)
    .populate("attractionId", "name category address rating photos")
    .lean();
}

export async function findReviewsByUserId(userId) {
  return Review.find({ userId })
    .populate("attractionId", "name category address rating photos")
    .sort({ createdAt: -1 })
    .lean();
}

export async function updateReviewById(reviewId, reviewData) {
  return Review.findByIdAndUpdate(
    reviewId,
    { $set: reviewData },
    { new: true, runValidators: true }
  )
    .populate("attractionId", "name category address rating photos")
    .lean();
}

export async function removeReviewPhotoByPublicId(reviewId, publicId) {
  return Review.findOneAndUpdate(
    { _id: reviewId, "photos.publicId": publicId },
    { $pull: { photos: { publicId } } },
    { new: true, runValidators: true }
  ).lean();
}

export async function deleteReviewById(reviewId) {
  return Review.findByIdAndDelete(reviewId).lean();
}

export async function addReviewLike(reviewId, userId) {
  return Review.findByIdAndUpdate(
    reviewId,
    { $addToSet: { likes: userId } },
    { new: true }
  ).lean();
}

export async function removeReviewLike(reviewId, userId) {
  return Review.findByIdAndUpdate(
    reviewId,
    { $pull: { likes: userId } },
    { new: true }
  ).lean();
}