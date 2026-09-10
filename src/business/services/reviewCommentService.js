import mongoose from "mongoose";
import {
  countCommentsForReview,
  createComment,
  deleteOwnedComment,
  findCommentByIdAndReviewId,
  findCommentsByReview,
} from "@/data/repositories/reviewCommentRepository";
import { findReviewById } from "@/data/repositories/reviewRepository";
import { findUserByEmail } from "@/data/repositories/userRepository";

const COMMENT_LIMIT = 3;
const MAX_COMMENT_LENGTH = 500;
const MAX_COMMENT_PAGE = 100000;

export class ReviewCommentServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ReviewCommentServiceError";
    this.statusCode = statusCode;
  }
}

export function createReviewCommentService({
  findComments = findCommentsByReview,
  createCommentRecord = createComment,
  findComment = findCommentByIdAndReviewId,
  deleteComment = deleteOwnedComment,
  countComments = countCommentsForReview,
  findReview = findReviewById,
  findUser = findUserByEmail,
  isValidObjectId = mongoose.Types.ObjectId.isValid,
} = {}) {
  function normalizeObjectId(value, label) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";

    if (!isValidObjectId(normalizedValue)) {
      throw new ReviewCommentServiceError(`Invalid ${label} ID.`, 400);
    }

    return normalizedValue;
  }

  function normalizePage(value) {
    if (value === undefined || value === null || value === "") {
      return 1;
    }

    const normalizedValue = String(value).trim();

    if (!/^[1-9]\d*$/.test(normalizedValue)) {
      throw new ReviewCommentServiceError(
        "Page must be a positive integer.",
        400
      );
    }

    const page = Number(normalizedValue);

    if (!Number.isSafeInteger(page) || page > MAX_COMMENT_PAGE) {
      throw new ReviewCommentServiceError(
        `Page must be between 1 and ${MAX_COMMENT_PAGE.toLocaleString("en-GB")}.`,
        400
      );
    }

    return page;
  }

  function normalizeCommentText(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new ReviewCommentServiceError("Comment text is required.", 400);
    }

    const normalizedText = value.trim();

    if (normalizedText.length > MAX_COMMENT_LENGTH) {
      throw new ReviewCommentServiceError(
        `Comment text must be ${MAX_COMMENT_LENGTH} characters or fewer.`,
        400
      );
    }

    return normalizedText;
  }

  async function resolveUser(email, { required }) {
    const normalizedEmail = typeof email === "string" ? email.trim() : "";

    if (!normalizedEmail) {
      if (required) {
        throw new ReviewCommentServiceError("User account not found.", 404);
      }
      return null;
    }

    const user = await findUser(normalizedEmail);

    if (!user && required) {
      throw new ReviewCommentServiceError("User account not found.", 404);
    }

    return user;
  }

  function serializeComment(comment, viewerId = null, reviewerOverride = null) {
    const reviewer = reviewerOverride || comment._commentReviewer;
    const reviewerName =
      reviewer?.displayName?.trim() ||
      reviewer?.name?.trim() ||
      "Chatlas traveller";
    const reviewerAvatar = reviewer?.profilePicture?.trim() || "";
    const reviewerId = reviewer?._id?.toString() || "";
    const ownerId = comment.userId?._id ?? comment.userId;

    return {
      id: comment._id.toString(),
      commentText: comment.commentText?.trim() || "",
      createdAt: comment.createdAt || null,
      updatedAt: comment.updatedAt || null,
      reviewer: {
        id: reviewerId,
        name: reviewerName,
        avatar: reviewerAvatar,
      },
      canDelete:
        Boolean(viewerId) && ownerId?.toString() === viewerId.toString(),
    };
  }

  return {
    async getComments({ reviewId, email = "", page }) {
      const normalizedReviewId = normalizeObjectId(reviewId, "Review");
      const normalizedPage = normalizePage(page);
      const [review, viewer] = await Promise.all([
        findReview(normalizedReviewId),
        resolveUser(email, { required: false }),
      ]);

      if (!review) {
        throw new ReviewCommentServiceError("Review not found.", 404);
      }

      const { items, totalComments } = await findComments({
        reviewId: normalizedReviewId,
        page: normalizedPage,
        limit: COMMENT_LIMIT,
      });
      const totalPages =
        totalComments === 0 ? 0 : Math.ceil(totalComments / COMMENT_LIMIT);

      return {
        comments: items.map((comment) =>
          serializeComment(comment, viewer?._id)
        ),
        page: normalizedPage,
        limit: COMMENT_LIMIT,
        totalComments,
        totalPages,
      };
    },

    async postComment({ reviewId, email, commentText }) {
      const normalizedReviewId = normalizeObjectId(reviewId, "Review");
      const normalizedCommentText = normalizeCommentText(commentText);
      const [review, user] = await Promise.all([
        findReview(normalizedReviewId),
        resolveUser(email, { required: true }),
      ]);

      if (!review) {
        throw new ReviewCommentServiceError("Review not found.", 404);
      }

      const comment = await createCommentRecord({
        reviewId: normalizedReviewId,
        userId: user._id,
        commentText: normalizedCommentText,
      });
      const commentCount = await countComments(normalizedReviewId);

      return {
        comment: serializeComment(comment, user._id, user),
        commentCount,
      };
    },

    async removeComment({ reviewId, commentId, email }) {
      const normalizedReviewId = normalizeObjectId(reviewId, "Review");
      const normalizedCommentId = normalizeObjectId(commentId, "Comment");
      const [review, user, comment] = await Promise.all([
        findReview(normalizedReviewId),
        resolveUser(email, { required: true }),
        findComment(normalizedCommentId, normalizedReviewId),
      ]);

      if (!review) {
        throw new ReviewCommentServiceError("Review not found.", 404);
      }

      if (!comment) {
        throw new ReviewCommentServiceError("Comment not found.", 404);
      }

      if (comment.userId?.toString() !== user._id.toString()) {
        throw new ReviewCommentServiceError(
          "You can only delete your own comments.",
          403
        );
      }

      const deletedComment = await deleteComment({
        commentId: normalizedCommentId,
        reviewId: normalizedReviewId,
        userId: user._id,
      });

      if (!deletedComment) {
        throw new ReviewCommentServiceError("Comment not found.", 404);
      }

      return {
        commentId: normalizedCommentId,
        commentCount: await countComments(normalizedReviewId),
      };
    },
  };
}

const reviewCommentService = createReviewCommentService();

export function getReviewComments(options) {
  return reviewCommentService.getComments(options);
}

export function submitReviewComment(options) {
  return reviewCommentService.postComment(options);
}

export function deleteReviewComment(options) {
  return reviewCommentService.removeComment(options);
}
