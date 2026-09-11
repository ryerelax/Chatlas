import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { findAttractionById } from "@/data/repositories/attractionRepository";
import {
  addReviewLike,
  createReview,
  deleteReviewById,
  findCommunityReviews,
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
  countCommentsByReviewIds,
  deleteCommentsByReviewId,
} from "@/data/repositories/reviewCommentRepository";
import {
  deleteImageByPublicId,
  uploadImageWithMetadataFromBuffer,
} from "@/infrastructure/external/cloudinary";
import {
  isValidPhotoSize,
  isValidPhotoType,
} from "@/business/services/photoValidation";
import {
  IMAGE_MODERATION_CODES,
  ImageModerationError,
  moderateUploadedImageFiles,
} from "@/business/services/imageModerationService";
import { containsProfanity } from "@/business/services/contentModerationService";

const MAX_REVIEW_PHOTOS = 3;
const DEFAULT_REVIEW_PAGE = 1;
const DEFAULT_REVIEW_LIMIT = 5;
const MAX_REVIEW_LIMIT = 20;
const MAX_REVIEW_PAGE = 100000;
const COMMUNITY_REVIEW_LIMIT = 5;
const MAX_COMMUNITY_SEARCH_LENGTH = 80;
const REVIEW_SORT_OPTIONS = new Set([
  "newest",
  "oldest",
  "highest-rating",
  "lowest-rating",
  "most-liked",
]);
const COMMUNITY_REVIEW_SORT_OPTIONS = new Set([
  "newest",
  "highest-rating",
  "most-liked",
]);
const COMMUNITY_REVIEW_FILTER_OPTIONS = new Set([
  "all",
  "with-photos",
  "rating-4-plus",
]);

export class ReviewServiceError extends Error {
  constructor(message, statusCode, code = "") {
    super(message);
    this.name = "ReviewServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function asReviewImageError(error) {
  if (error instanceof ImageModerationError) {
    return new ReviewServiceError(
      error.message,
      error.statusCode,
      error.code
    );
  }
  return error;
}

export function createReviewSubmissionService({
  findAttraction,
  findUser,
  moderateFiles,
  uploadImage,
  createReviewRecord,
  deleteImage,
  createUuid,
}) {
  return async function submitReviewWithDependencies({
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

    if (!normalizedEmail) {
      throw new ReviewServiceError("User account not found.", 404);
    }

    const [attraction, user] = await Promise.all([
      findAttraction(normalizedAttractionId),
      findUser(normalizedEmail),
    ]);

    if (!attraction) {
      throw new ReviewServiceError("Attraction not found.", 404);
    }
    if (!user) {
      throw new ReviewServiceError("User account not found.", 404);
    }

    const normalizedPhotoFiles = validateReviewPhotos(photoFiles);
    let approvedPhotos;
    try {
      // The complete batch is moderated before the first public upload.
      approvedPhotos = await moderateFiles(normalizedPhotoFiles);
    } catch (error) {
      throw asReviewImageError(error);
    }

    const uploadedPhotos = [];
    let review;

    try {
      for (const photo of approvedPhotos) {
        const uploadedPhoto = await uploadImage(
          photo.buffer,
          photo.mimeType,
          {
            folder: `chatlas/reviews/${normalizedAttractionId}`,
            publicId: `review-${createUuid()}`,
          }
        );
        uploadedPhotos.push(uploadedPhoto);
      }

      review = await createReviewRecord({
        attractionId: normalizedAttractionId,
        userId: user._id,
        userName: user.displayName || user.name,
        userAvatar: user.profilePicture || "",
        rating: normalizedRating,
        reviewText: normalizedReviewText,
        photos: uploadedPhotos,
      });
    } catch (error) {
      await Promise.allSettled(
        uploadedPhotos.map((photo) => deleteImage(photo.publicId))
      );
      throw error;
    }

    // Persistence succeeded, so later presentation work must never remove
    // assets now referenced by the Review document.
    return serializeReviewForViewer(review, user._id, 0);
  };
}

const submitReviewWithDependencies = createReviewSubmissionService({
  findAttraction: findAttractionById,
  findUser: findUserByEmail,
  moderateFiles: moderateUploadedImageFiles,
  uploadImage: uploadImageWithMetadataFromBuffer,
  createReviewRecord: createReview,
  deleteImage: deleteImageByPublicId,
  createUuid: randomUUID,
});

export async function submitReview(input) {
  return submitReviewWithDependencies(input);
}

export function createReviewPhotoUpdatePersistence({
  uploadImage,
  updateReviewRecord,
  deleteImage,
  createUuid,
}) {
  return async function persistReviewPhotoUpdate({
    reviewId,
    attractionId,
    retainedPhotos,
    approvedPhotos,
    rating,
    reviewText,
    lastEditedAt,
  }) {
    const uploadedPhotos = [];

    try {
      for (const photo of approvedPhotos) {
        const uploadedPhoto = await uploadImage(
          photo.buffer,
          photo.mimeType,
          {
            folder: `chatlas/reviews/${attractionId}`,
            publicId: `review-${createUuid()}`,
          }
        );
        uploadedPhotos.push(uploadedPhoto);
      }

      const updatedReview = await updateReviewRecord(reviewId, {
        rating,
        reviewText,
        photos: [...retainedPhotos, ...uploadedPhotos],
        lastEditedAt,
      });

      if (!updatedReview) {
        throw new ReviewServiceError("Review not found.", 404);
      }

      return updatedReview;
    } catch (error) {
      await Promise.allSettled(
        uploadedPhotos.map((photo) => deleteImage(photo.publicId))
      );
      throw error;
    }
  };
}

const persistReviewPhotoUpdate = createReviewPhotoUpdatePersistence({
  uploadImage: uploadImageWithMetadataFromBuffer,
  updateReviewRecord: updateReviewById,
  deleteImage: deleteImageByPublicId,
  createUuid: randomUUID,
});

export async function getReviewsByAttraction({
  attractionId,
  email = "",
  page,
  limit,
  sort,
}) {
  const normalizedAttractionId =
    typeof attractionId === "string" ? attractionId.trim() : "";

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    return null;
  }

  const normalizedPage = normalizeReviewListInteger(page, {
    defaultValue: DEFAULT_REVIEW_PAGE,
    maximum: MAX_REVIEW_PAGE,
    label: "Page",
  });
  const normalizedLimit = normalizeReviewListInteger(limit, {
    defaultValue: DEFAULT_REVIEW_LIMIT,
    maximum: MAX_REVIEW_LIMIT,
    label: "Limit",
  });
  const normalizedSort = normalizeReviewSort(sort);

  const [{ items, totalReviews }, viewer] = await Promise.all([
    findReviewsByAttraction({
      attractionId: normalizedAttractionId,
      page: normalizedPage,
      limit: normalizedLimit,
      sort: normalizedSort,
    }),
    findOptionalUserByEmail(email),
  ]);

  const commentCounts = await getCommentCounts(items);
  const totalPages =
    totalReviews === 0 ? 0 : Math.ceil(totalReviews / normalizedLimit);

  return {
    reviews: items.map((review) =>
      serializeReviewForViewer(
        review,
        viewer?._id,
        commentCounts.get(review._id.toString()) || 0
      )
    ),
    page: normalizedPage,
    limit: normalizedLimit,
    sort: normalizedSort,
    totalReviews,
    totalPages,
  };
}

export async function getCommunityReviews({
  email = "",
  page,
  sort,
  search,
  filter,
}) {
  const normalizedPage = normalizeReviewListInteger(page, {
    defaultValue: DEFAULT_REVIEW_PAGE,
    maximum: MAX_REVIEW_PAGE,
    label: "Page",
  });
  const normalizedSort = normalizeCommunityReviewSort(sort);
  const normalizedSearch = normalizeCommunityReviewSearch(search);
  const normalizedFilter = normalizeCommunityReviewFilter(filter);
  const searchPattern = normalizedSearch
    ? escapeRegularExpression(normalizedSearch)
    : "";

  const [{ items, totalReviews }, viewer] = await Promise.all([
    findCommunityReviews({
      page: normalizedPage,
      limit: COMMUNITY_REVIEW_LIMIT,
      sort: normalizedSort,
      searchPattern,
      filter: normalizedFilter,
    }),
    findOptionalUserByEmail(email),
  ]);
  const commentCounts = await getCommentCounts(items);
  const totalPages =
    totalReviews === 0
      ? 0
      : Math.ceil(totalReviews / COMMUNITY_REVIEW_LIMIT);

  return {
    reviews: items.map((review) =>
      serializeCommunityReviewForViewer(
        review,
        viewer?._id,
        commentCounts.get(review._id.toString()) || 0
      )
    ),
    page: normalizedPage,
    limit: COMMUNITY_REVIEW_LIMIT,
    search: normalizedSearch,
    sort: normalizedSort,
    filter: normalizedFilter,
    totalReviews,
    totalPages,
  };
}

function normalizeReviewListInteger(
  value,
  { defaultValue, maximum, label }
) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const normalizedValue =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw new ReviewServiceError(
      `${label} must be a positive integer.`,
      400
    );
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue > maximum) {
    throw new ReviewServiceError(
      `${label} must be between 1 and ${maximum.toLocaleString("en-GB")}.`,
      400
    );
  }

  return parsedValue;
}

function normalizeReviewSort(sort) {
  if (sort === undefined || sort === null) {
    return "newest";
  }

  const normalizedSort = typeof sort === "string" ? sort.trim() : "";

  if (!REVIEW_SORT_OPTIONS.has(normalizedSort)) {
    throw new ReviewServiceError("Invalid review sort option.", 400);
  }

  return normalizedSort;
}

function normalizeCommunityReviewSort(sort) {
  if (sort === undefined || sort === null || sort === "") {
    return "newest";
  }

  const normalizedSort = typeof sort === "string" ? sort.trim() : "";

  if (!COMMUNITY_REVIEW_SORT_OPTIONS.has(normalizedSort)) {
    throw new ReviewServiceError("Invalid Community review sort option.", 400);
  }

  return normalizedSort;
}

function normalizeCommunityReviewFilter(filter) {
  if (filter === undefined || filter === null || filter === "") {
    return "all";
  }

  const normalizedFilter = typeof filter === "string" ? filter.trim() : "";

  if (!COMMUNITY_REVIEW_FILTER_OPTIONS.has(normalizedFilter)) {
    throw new ReviewServiceError("Invalid Community review filter.", 400);
  }

  return normalizedFilter;
}

function normalizeCommunityReviewSearch(search) {
  if (search === undefined || search === null) {
    return "";
  }

  if (typeof search !== "string") {
    throw new ReviewServiceError("Invalid Community review search.", 400);
  }

  const normalizedSearch = search.trim();

  if (normalizedSearch.length > MAX_COMMUNITY_SEARCH_LENGTH) {
    throw new ReviewServiceError(
      `Search must be ${MAX_COMMUNITY_SEARCH_LENGTH} characters or fewer.`,
      400
    );
  }

  return normalizedSearch;
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (containsProfanity(normalizedReviewText)) {
    throw new ReviewServiceError(
      "Please remove any inappropriate language from your review and try again.",
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
      throw new ReviewServiceError(
        "Each photo must contain an image.",
        400,
        IMAGE_MODERATION_CODES.invalid
      );
    }

    if (!isValidPhotoType(photoFile.type)) {
      throw new ReviewServiceError(
        "Photos must be JPEG or PNG images.",
        400,
        IMAGE_MODERATION_CODES.unsupported
      );
    }

    if (!isValidPhotoSize(photoFile.size)) {
      throw new ReviewServiceError(
        "Each photo must be 5 MB or smaller.",
        400,
        IMAGE_MODERATION_CODES.tooLarge
      );
    }
  }

  return photoFiles;
}

export async function getReviewById(reviewId, email = "") {
  const normalizedReviewId = normalizeReviewId(reviewId);
  const [review, viewer, commentCounts] = await Promise.all([
    findReviewByIdWithAttraction(normalizedReviewId),
    findOptionalUserByEmail(email),
    getCommentCounts([{ _id: normalizedReviewId }]),
  ]);

  if (!review) {
    throw new ReviewServiceError("Review not found.", 404);
  }

  return serializeReviewForViewer(
    review,
    viewer?._id,
    commentCounts.get(normalizedReviewId) || 0
  );
}

export async function getReviewsByAuthenticatedUser(email) {
  const user = await resolveUserByEmail(email);
  const reviews = await findReviewsByUserId(user._id);
  const commentCounts = await getCommentCounts(reviews);

  return reviews.map((review) =>
    serializeReviewForViewer(
      review,
      user._id,
      commentCounts.get(review._id.toString()) || 0
    )
  );
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

  const normalizedPhotoFiles = validateReviewPhotos(photoFiles);

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

  let approvedPhotos;

  try {
    approvedPhotos = await moderateUploadedImageFiles(normalizedPhotoFiles);
  } catch (error) {
    throw asReviewImageError(error);
  }

  const updatedReview = await persistReviewPhotoUpdate({
    reviewId: normalizedReviewId,
    attractionId: review.attractionId,
    retainedPhotos,
    approvedPhotos,
    rating: normalizedRating,
    reviewText: normalizedReviewText,
    lastEditedAt: new Date(),
  });

  // The Review now owns the new asset set. Old-asset cleanup is best effort
  // and must not roll back assets that the database already references.
  await deleteCloudinaryPhotos(normalizedDeletePhotoPublicIds);
  let commentCount = 0;
  try {
    const commentCounts = await getCommentCounts([updatedReview]);
    commentCount = commentCounts.get(updatedReview._id.toString()) || 0;
  } catch {
    // The Review update is already committed. A transient count lookup must
    // not turn a successful image update into an ambiguous failed response.
  }

  return serializeReviewForViewer(
    updatedReview,
    user._id,
    commentCount
  );
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

  const session = await mongoose.startSession();
  let deletedReview;

  try {
    await session.withTransaction(async () => {
      await deleteCommentsByReviewId(normalizedReviewId, { session });
      deletedReview = await deleteReviewById(normalizedReviewId, { session });

      if (!deletedReview) {
        throw new ReviewServiceError("Review not found.", 404);
      }
    });
  } finally {
    await session.endSession();
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

function serializeReviewForViewer(
  review,
  viewerId = null,
  commentCount = 0
) {
  const publicReview = { ...review };
  delete publicReview.likes;

  return {
    ...publicReview,
    ...createReviewLikeState(review, viewerId),
    commentCount: normalizeCommentCount(commentCount),
  };
}

function serializeCommunityReviewForViewer(
  review,
  viewerId = null,
  commentCount = 0
) {
  const reviewer = review._communityReviewer;
  const attraction = review._communityAttraction;
  const likeState = createReviewLikeState(review, viewerId);
  const reviewerName =
    reviewer?.displayName?.trim() ||
    reviewer?.name?.trim() ||
    review.userName?.trim() ||
    "Chatlas traveller";
  const reviewerAvatar =
    reviewer?.profilePicture?.trim() || review.userAvatar?.trim() || "";

  return {
    _id: review._id.toString(),
    reviewer: reviewer?._id
      ? {
          id: reviewer._id.toString(),
          name: reviewerName,
          avatar: reviewerAvatar,
        }
      : {
          id: "",
          name: reviewerName,
          avatar: reviewerAvatar,
        },
    attraction:
      attraction?._id && attraction?.name
        ? {
            id: attraction._id.toString(),
            name: attraction.name,
          }
        : null,
    rating: Number(review.rating) || 0,
    reviewText: review.reviewText?.trim() || "",
    photos: getReviewPhotos(review.photos).map((photo) => ({
      url: photo.url,
      publicId: photo.publicId,
    })),
    createdAt: review.createdAt || null,
    ...likeState,
    commentCount: normalizeCommentCount(commentCount),
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

async function getCommentCounts(reviews) {
  const reviewIds = reviews
    .map((review) => review?._id?.toString())
    .filter(Boolean);
  const counts = await countCommentsByReviewIds(reviewIds);

  return new Map(
    counts.map((item) => [
      item._id.toString(),
      normalizeCommentCount(item.commentCount),
    ])
  );
}

function normalizeCommentCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}
