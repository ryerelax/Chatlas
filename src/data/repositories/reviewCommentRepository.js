import mongoose from "mongoose";
import ReviewComment from "@/data/models/ReviewComment";
import User from "@/data/models/User";

export function createReviewCommentRepository({
  ReviewCommentModel,
  UserModel,
  toObjectId = (value) => new mongoose.Types.ObjectId(value),
}) {
  return {
    async findCommentsByReview({ reviewId, page, limit }) {
      const skip = (page - 1) * limit;
      const [result] = await ReviewCommentModel.aggregate([
        { $match: { reviewId: toObjectId(reviewId) } },
        {
          $facet: {
            items: [
              { $sort: { createdAt: -1, _id: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $lookup: {
                  from: UserModel.collection.name,
                  let: { commenterId: "$userId" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $eq: ["$_id", "$$commenterId"] },
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
                  as: "_commentReviewer",
                },
              },
              {
                $unwind: {
                  path: "$_commentReviewer",
                  preserveNullAndEmptyArrays: true,
                },
              },
            ],
            metadata: [{ $count: "totalComments" }],
          },
        },
        {
          $project: {
            items: 1,
            totalComments: {
              $ifNull: [
                { $arrayElemAt: ["$metadata.totalComments", 0] },
                0,
              ],
            },
          },
        },
      ]);

      return result || { items: [], totalComments: 0 };
    },

    async createComment(commentData) {
      const comment = await ReviewCommentModel.create(commentData);
      return comment.toObject();
    },

    async findCommentByIdAndReviewId(commentId, reviewId) {
      return ReviewCommentModel.findOne({
        _id: commentId,
        reviewId,
      }).lean();
    },

    async deleteOwnedComment({ commentId, reviewId, userId }) {
      return ReviewCommentModel.findOneAndDelete({
        _id: commentId,
        reviewId,
        userId,
      }).lean();
    },

    async countCommentsForReview(reviewId) {
      return ReviewCommentModel.countDocuments({ reviewId });
    },

    async countCommentsByReviewIds(reviewIds) {
      if (reviewIds.length === 0) {
        return [];
      }

      return ReviewCommentModel.aggregate([
        {
          $match: {
            reviewId: { $in: reviewIds.map(toObjectId) },
          },
        },
        {
          $group: {
            _id: "$reviewId",
            commentCount: { $sum: 1 },
          },
        },
      ]);
    },

    async deleteCommentsByReviewId(reviewId, { session } = {}) {
      const query = ReviewCommentModel.deleteMany({ reviewId });
      return session ? query.session(session) : query;
    },
  };
}

const reviewCommentRepository = createReviewCommentRepository({
  ReviewCommentModel: ReviewComment,
  UserModel: User,
});

export function findCommentsByReview(options) {
  return reviewCommentRepository.findCommentsByReview(options);
}

export function createComment(commentData) {
  return reviewCommentRepository.createComment(commentData);
}

export function findCommentByIdAndReviewId(commentId, reviewId) {
  return reviewCommentRepository.findCommentByIdAndReviewId(
    commentId,
    reviewId
  );
}

export function deleteOwnedComment(options) {
  return reviewCommentRepository.deleteOwnedComment(options);
}

export function countCommentsForReview(reviewId) {
  return reviewCommentRepository.countCommentsForReview(reviewId);
}

export function countCommentsByReviewIds(reviewIds) {
  return reviewCommentRepository.countCommentsByReviewIds(reviewIds);
}

export function deleteCommentsByReviewId(reviewId, options) {
  return reviewCommentRepository.deleteCommentsByReviewId(reviewId, options);
}
