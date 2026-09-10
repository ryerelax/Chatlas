import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createReviewCommentService,
  ReviewCommentServiceError,
} from "../src/business/services/reviewCommentService.js";
import { createReviewCommentRepository } from "../src/data/repositories/reviewCommentRepository.js";
import ReviewComment from "../src/data/models/ReviewComment.js";

const REVIEW_ID = "507f1f77bcf86cd799439011";
const COMMENT_ID = "507f1f77bcf86cd799439012";
const USER_ID = "507f1f77bcf86cd799439013";
const OTHER_USER_ID = "507f1f77bcf86cd799439014";

function createService(overrides = {}) {
  return createReviewCommentService({
    findComments: async () => ({ items: [], totalComments: 0 }),
    createCommentRecord: async (data) => ({
      _id: COMMENT_ID,
      ...data,
      createdAt: new Date("2026-08-28T00:00:00.000Z"),
      updatedAt: new Date("2026-08-28T00:00:00.000Z"),
    }),
    findComment: async () => null,
    deleteComment: async () => null,
    countComments: async () => 0,
    findReview: async () => ({ _id: REVIEW_ID }),
    findUser: async () => ({
      _id: USER_ID,
      name: "Google name",
      displayName: "Melaka Traveller",
      profilePicture: "https://example.com/avatar.jpg",
      email: "private@example.com",
      googleId: "private-google-id",
    }),
    isValidObjectId: (value) =>
      [REVIEW_ID, COMMENT_ID, USER_ID, OTHER_USER_ID].includes(value),
    ...overrides,
  });
}

test("ReviewComment schema uses Review and User ObjectIds with timestamps and the paging index", () => {
  assert.equal(ReviewComment.schema.path("reviewId").instance, "ObjectId");
  assert.equal(ReviewComment.schema.path("reviewId").options.ref, "Review");
  assert.equal(ReviewComment.schema.path("userId").instance, "ObjectId");
  assert.equal(ReviewComment.schema.path("userId").options.ref, "User");
  assert.equal(ReviewComment.schema.path("commentText").options.maxlength, 500);
  assert.ok(ReviewComment.schema.path("createdAt"));
  assert.ok(ReviewComment.schema.path("updatedAt"));
  assert.deepEqual(ReviewComment.schema.indexes()[0][0], {
    reviewId: 1,
    createdAt: -1,
    _id: -1,
  });
});

test("comment repository paginates newest first and looks up only public reviewer fields", async () => {
  const pipelines = [];
  const repository = createReviewCommentRepository({
    ReviewCommentModel: {
      aggregate(pipeline) {
        pipelines.push(pipeline);
        return [{ items: [], totalComments: 0 }];
      },
    },
    UserModel: { collection: { name: "users" } },
    toObjectId: (value) => `object-id:${value}`,
  });

  await repository.findCommentsByReview({
    reviewId: REVIEW_ID,
    page: 2,
    limit: 3,
  });

  assert.deepEqual(pipelines[0][0], {
    $match: { reviewId: `object-id:${REVIEW_ID}` },
  });
  const itemPipeline = pipelines[0][1].$facet.items;
  assert.deepEqual(itemPipeline.slice(0, 3), [
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: 3 },
    { $limit: 3 },
  ]);
  const reviewerProjection = itemPipeline[3].$lookup.pipeline[1].$project;
  assert.deepEqual(reviewerProjection, {
    _id: 1,
    name: 1,
    displayName: 1,
    profilePicture: 1,
  });
});

test("batch comment counts use one grouped aggregation for selected Reviews", async () => {
  const pipelines = [];
  const repository = createReviewCommentRepository({
    ReviewCommentModel: {
      aggregate(pipeline) {
        pipelines.push(pipeline);
        return [];
      },
    },
    UserModel: { collection: { name: "users" } },
    toObjectId: (value) => `object-id:${value}`,
  });

  await repository.countCommentsByReviewIds([REVIEW_ID, COMMENT_ID]);

  assert.deepEqual(pipelines[0], [
    {
      $match: {
        reviewId: {
          $in: [`object-id:${REVIEW_ID}`, `object-id:${COMMENT_ID}`],
        },
      },
    },
    {
      $group: {
        _id: "$reviewId",
        commentCount: { $sum: 1 },
      },
    },
  ]);
});

test("public comment serialization exposes safe reviewer fields and viewer deletion state", async () => {
  const service = createService({
    findComments: async () => ({
      items: [
        {
          _id: COMMENT_ID,
          reviewId: REVIEW_ID,
          userId: USER_ID,
          commentText: "  A useful comment.  ",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
          _commentReviewer: {
            _id: USER_ID,
            displayName: "Traveller",
            profilePicture: "https://example.com/avatar.jpg",
            email: "private@example.com",
            googleId: "private-google-id",
          },
        },
      ],
      totalComments: 4,
    }),
  });

  const result = await service.getComments({
    reviewId: REVIEW_ID,
    email: "session@example.com",
    page: 1,
  });

  assert.equal(result.limit, 3);
  assert.equal(result.totalPages, 2);
  assert.deepEqual(result.comments[0].reviewer, {
    id: USER_ID,
    name: "Traveller",
    avatar: "https://example.com/avatar.jpg",
  });
  assert.equal(result.comments[0].commentText, "A useful comment.");
  assert.equal(result.comments[0].canDelete, true);
  assert.equal("userId" in result.comments[0], false);
  assert.equal("email" in result.comments[0].reviewer, false);
  assert.equal("googleId" in result.comments[0].reviewer, false);
});

test("guests can read comments but receive no deletion authority", async () => {
  const service = createService({
    findUser: async () => {
      throw new Error("guest GET must not query without an email");
    },
    findComments: async () => ({
      items: [
        {
          _id: COMMENT_ID,
          userId: USER_ID,
          commentText: "Public comment",
          _commentReviewer: { _id: USER_ID, name: "Traveller" },
        },
      ],
      totalComments: 1,
    }),
  });

  const result = await service.getComments({ reviewId: REVIEW_ID });
  assert.equal(result.comments[0].canDelete, false);
});

test("posting derives MongoDB ownership from the session email and accepts 500 characters", async () => {
  const observed = {};
  const service = createService({
    createCommentRecord: async (data) => {
      observed.data = data;
      return {
        _id: COMMENT_ID,
        ...data,
        createdAt: new Date("2026-08-28T00:00:00.000Z"),
        updatedAt: new Date("2026-08-28T00:00:00.000Z"),
      };
    },
    countComments: async () => 6,
  });

  const result = await service.postComment({
    reviewId: REVIEW_ID,
    email: "session@example.com",
    commentText: "x".repeat(500),
    userId: OTHER_USER_ID,
  });

  assert.equal(observed.data.userId, USER_ID);
  assert.equal(observed.data.commentText.length, 500);
  assert.equal(result.commentCount, 6);
  assert.equal(result.comment.canDelete, true);
  assert.equal("userId" in result.comment, false);
});

test("posting rejects whitespace and comments over 500 characters", async () => {
  const service = createService();

  for (const commentText of ["   ", "x".repeat(501)]) {
    await assert.rejects(
      () =>
        service.postComment({
          reviewId: REVIEW_ID,
          email: "session@example.com",
          commentText,
        }),
      (error) =>
        error instanceof ReviewCommentServiceError && error.statusCode === 400
    );
  }
});

test("comment deletion is author-only and uses an atomic ownership filter", async () => {
  const observed = {};
  const service = createService({
    findComment: async () => ({
      _id: COMMENT_ID,
      reviewId: REVIEW_ID,
      userId: USER_ID,
    }),
    deleteComment: async (filter) => {
      observed.filter = filter;
      return { _id: COMMENT_ID };
    },
    countComments: async () => 2,
  });

  const result = await service.removeComment({
    reviewId: REVIEW_ID,
    commentId: COMMENT_ID,
    email: "session@example.com",
  });

  assert.deepEqual(observed.filter, {
    commentId: COMMENT_ID,
    reviewId: REVIEW_ID,
    userId: USER_ID,
  });
  assert.deepEqual(result, { commentId: COMMENT_ID, commentCount: 2 });

  const forbiddenService = createService({
    findComment: async () => ({ userId: OTHER_USER_ID }),
  });
  await assert.rejects(
    () =>
      forbiddenService.removeComment({
        reviewId: REVIEW_ID,
        commentId: COMMENT_ID,
        email: "session@example.com",
      }),
    (error) =>
      error instanceof ReviewCommentServiceError && error.statusCode === 403
  );
});

test("comment routes keep identity server-side and do not import models or repositories", async () => {
  const routeSources = await Promise.all([
    readFile("src/app/api/reviews/[id]/comments/route.js", "utf8"),
    readFile(
      "src/app/api/reviews/[id]/comments/[commentId]/route.js",
      "utf8"
    ),
  ]);
  const source = routeSources.join("\n");

  assert.match(source, /session\.user\.email/);
  assert.doesNotMatch(source, /body\.(userId|email|name|avatar|googleId)/);
  assert.doesNotMatch(source, /@\/data\/models/);
  assert.doesNotMatch(source, /@\/data\/repositories/);
});

test("Review Comments remain Community-only and ReviewCard integration is additive", async () => {
  const [cardSource, feedSource] = await Promise.all([
    readFile("src/presentation/components/reviews/ReviewCard.js", "utf8"),
    readFile(
      "src/presentation/components/reviews/CommunityReviewFeed.js",
      "utf8"
    ),
  ]);

  assert.match(cardSource, /enableComments = false/);
  assert.match(cardSource, /aria-expanded=/);
  assert.match(feedSource, /enableComments/);
});

test("Review deletion removes comments and the Review in one transaction before photo cleanup", async () => {
  const [serviceSource, repositorySource] = await Promise.all([
    readFile("src/business/services/reviewService.js", "utf8"),
    readFile("src/data/repositories/reviewRepository.js", "utf8"),
  ]);
  const transactionStart = serviceSource.indexOf("session.withTransaction");
  const commentDelete = serviceSource.indexOf(
    "deleteCommentsByReviewId(normalizedReviewId, { session })",
    transactionStart
  );
  const reviewDelete = serviceSource.indexOf(
    "deleteReviewById(normalizedReviewId, { session })",
    transactionStart
  );
  const photoCleanup = serviceSource.indexOf(
    "await deleteCloudinaryPhotos(",
    reviewDelete
  );

  assert.ok(transactionStart >= 0);
  assert.ok(commentDelete > transactionStart);
  assert.ok(reviewDelete > commentDelete);
  assert.ok(photoCleanup > reviewDelete);
  assert.match(repositorySource, /deleteReviewById\(reviewId, \{ session \} = \{\}\)/);
});
