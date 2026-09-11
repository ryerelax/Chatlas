import { countCommentsByReviewIds } from "@/data/repositories/reviewCommentRepository";
import { findPaginatedReviewsByUserId } from "@/data/repositories/reviewRepository";
import { findUserByEmail } from "@/data/repositories/userRepository";

export const MY_REVIEWS_PAGE_SIZE = 6;
const MAX_SEARCH_LENGTH = 100;

export class MyReviewsServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "MyReviewsServiceError";
    this.statusCode = statusCode;
  }
}

function normalizePage(value) {
  const page = Math.trunc(Number(value) || 1);
  return Math.max(1, page);
}

function normalizeSearch(value) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_SEARCH_LENGTH)
    : "";
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCommentCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function serializeReview(review, viewerId, commentCount = 0) {
  const publicReview = { ...review };
  delete publicReview.likes;
  const likeIds = new Set(
    (Array.isArray(review.likes) ? review.likes : [])
      .map((like) => like?._id ?? like)
      .map((likeId) => likeId?.toString?.())
      .filter(Boolean)
  );
  const normalizedViewerId = viewerId?.toString?.() || "";

  return {
    ...publicReview,
    _id: review._id?.toString?.() || "",
    likeCount: likeIds.size,
    likedByCurrentUser:
      Boolean(normalizedViewerId) && likeIds.has(normalizedViewerId),
    commentCount: normalizeCommentCount(commentCount),
  };
}

export function createMyReviewsService({
  findUser = findUserByEmail,
  findReviews = findPaginatedReviewsByUserId,
  countComments = countCommentsByReviewIds,
} = {}) {
  return async function getMyReviews({ email = "", page = 1, search = "" } = {}) {
    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    if (!normalizedEmail) {
      throw new MyReviewsServiceError("User account not found.", 404);
    }

    const user = await findUser(normalizedEmail);
    if (!user?._id) {
      throw new MyReviewsServiceError("User account not found.", 404);
    }

    const requestedPage = normalizePage(page);
    const normalizedSearch = normalizeSearch(search);
    const repositoryInput = {
      userId: user._id,
      page: requestedPage,
      limit: MY_REVIEWS_PAGE_SIZE,
      searchPattern: normalizedSearch
        ? escapeRegularExpression(normalizedSearch)
        : "",
    };
    let result = await findReviews(repositoryInput);
    const total = Number(result?.totalReviews) || 0;
    const totalPages = Math.max(1, Math.ceil(total / MY_REVIEWS_PAGE_SIZE));
    const resolvedPage = Math.min(requestedPage, totalPages);

    if (resolvedPage !== requestedPage) {
      result = await findReviews({ ...repositoryInput, page: resolvedPage });
    }

    const reviews = Array.isArray(result?.items) ? result.items : [];
    const reviewIds = reviews
      .map((review) => review?._id?.toString?.())
      .filter(Boolean);
    const commentCounts = await countComments(reviewIds);
    const commentCountByReviewId = new Map(
      (commentCounts || []).map((item) => [
        item._id?.toString?.() || "",
        normalizeCommentCount(item.commentCount),
      ])
    );

    return {
      items: reviews.map((review) =>
        serializeReview(
          review,
          user._id,
          commentCountByReviewId.get(review._id?.toString?.() || "") || 0
        )
      ),
      search: normalizedSearch,
      pagination: {
        page: resolvedPage,
        limit: MY_REVIEWS_PAGE_SIZE,
        total,
        totalPages,
      },
    };
  };
}

export const getMyReviews = createMyReviewsService();
