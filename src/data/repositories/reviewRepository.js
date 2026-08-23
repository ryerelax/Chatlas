import mongoose from "mongoose";
import Attraction from "@/data/models/Attraction";
import Review from "@/data/models/Review";
import User from "@/data/models/User";

const REVIEW_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  "highest-rating": { rating: -1, createdAt: -1, _id: -1 },
  "lowest-rating": { rating: 1, createdAt: -1, _id: -1 },
};

const COMMUNITY_REVIEW_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  "highest-rating": { rating: -1, createdAt: -1, _id: -1 },
  "most-liked": {
    _reviewLikeCount: -1,
    createdAt: -1,
    _id: -1,
  },
};

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
 * @param {Object} options - Attraction, pagination, and sorting options
 * @returns {Promise<Object>} - Paginated reviews and their total count
 */
export async function findReviewsByAttraction({
  attractionId,
  page,
  limit,
  sort,
}) {
  const filter = { attractionId };
  const skip = (page - 1) * limit;
  const reviewsPromise =
    sort === "most-liked"
      ? findMostLikedReviews({ attractionId, skip, limit })
      : Review.find(filter)
          .sort(REVIEW_SORTS[sort])
          .skip(skip)
          .limit(limit)
          .lean();

  const [items, totalReviews] = await Promise.all([
    reviewsPromise,
    Review.countDocuments(filter),
  ]);

  return { items, totalReviews };
}

function findMostLikedReviews({ attractionId, skip, limit }) {
  return Review.aggregate([
    {
      $match: {
        attractionId: new mongoose.Types.ObjectId(attractionId),
      },
    },
    {
      $set: {
        _reviewLikeCount: {
          $size: {
            $setUnion: [{ $ifNull: ["$likes", []] }, []],
          },
        },
      },
    },
    {
      $sort: {
        _reviewLikeCount: -1,
        createdAt: -1,
        _id: -1,
      },
    },
    { $skip: skip },
    { $limit: limit },
    { $project: { _reviewLikeCount: 0 } },
  ]);
}

/**
 * Find public reviews for the Community feed without per-review lookups.
 * @param {Object} options - Search, pagination, and sorting options
 * @returns {Promise<Object>} - Paginated reviews and their total count
 */
export async function findCommunityReviews({
  page,
  limit,
  sort,
  searchPattern,
}) {
  const skip = (page - 1) * limit;
  const hasSearch = Boolean(searchPattern);
  const pipeline = [];

  if (hasSearch) {
    pipeline.push(
      createAttractionLookupStage(),
      createAttractionUnwindStage(),
      {
        $match: {
          $or: [
            {
              reviewText: {
                $regex: searchPattern,
                $options: "i",
              },
            },
            {
              "_communityAttraction.name": {
                $regex: searchPattern,
                $options: "i",
              },
            },
          ],
        },
      }
    );
  }

  const itemPipeline = [];

  if (sort === "most-liked") {
    itemPipeline.push({
      $set: {
        _reviewLikeCount: {
          $size: {
            $setUnion: [{ $ifNull: ["$likes", []] }, []],
          },
        },
      },
    });
  }

  itemPipeline.push(
    { $sort: COMMUNITY_REVIEW_SORTS[sort] },
    { $skip: skip },
    { $limit: limit }
  );

  if (!hasSearch) {
    itemPipeline.push(
      createAttractionLookupStage(),
      createAttractionUnwindStage()
    );
  }

  itemPipeline.push(
    createReviewerLookupStage(),
    {
      $unwind: {
        path: "$_communityReviewer",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $project: { _reviewLikeCount: 0 } }
  );

  const [result] = await Review.aggregate([
    ...pipeline,
    {
      $facet: {
        items: itemPipeline,
        metadata: [{ $count: "totalReviews" }],
      },
    },
    {
      $project: {
        items: 1,
        totalReviews: {
          $ifNull: [{ $arrayElemAt: ["$metadata.totalReviews", 0] }, 0],
        },
      },
    },
  ]);

  return result || { items: [], totalReviews: 0 };
}

function createAttractionLookupStage() {
  return {
    $lookup: {
      from: Attraction.collection.name,
      let: { attractionId: "$attractionId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$_id", "$$attractionId"] },
          },
        },
        { $project: { _id: 1, name: 1 } },
      ],
      as: "_communityAttraction",
    },
  };
}

function createAttractionUnwindStage() {
  return {
    $unwind: {
      path: "$_communityAttraction",
      preserveNullAndEmptyArrays: true,
    },
  };
}

function createReviewerLookupStage() {
  return {
    $lookup: {
      from: User.collection.name,
      let: { reviewerId: "$userId" },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$_id", "$$reviewerId"] },
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            displayName: 1,
            profilePicture: 1,
          },
        },
      ],
      as: "_communityReviewer",
    },
  };
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
