import assert from "node:assert/strict";
import test from "node:test";
import { createMyReviewsHandler } from "../src/app/api/my-reviews/handler.js";
import {
  createMyReviewsService,
  MY_REVIEWS_PAGE_SIZE,
} from "../src/business/services/myReviewsService.js";

function createReview(index, viewerId = "user-1") {
  return {
    _id: `review-${index}`,
    attractionId: {
      _id: `attraction-${index}`,
      name: `Attraction ${index}`,
      category: "Museum",
      photos: [],
    },
    rating: 5,
    reviewText: `Review ${index}`,
    photos: [],
    likes: index === 1 ? [viewerId] : [],
    createdAt: new Date(2026, 0, index),
  };
}

function createServiceFixture(total = 7) {
  const reviews = Array.from({ length: total }, (_, index) =>
    createReview(index + 1)
  );
  const observed = [];
  const service = createMyReviewsService({
    findUser: async () => ({ _id: "user-1" }),
    findReviews: async (input) => {
      observed.push(input);
      return {
        items: reviews.slice(
          (input.page - 1) * input.limit,
          input.page * input.limit
        ),
        totalReviews: total,
      };
    },
    countComments: async (reviewIds) =>
      reviewIds.map((reviewId) => ({ _id: reviewId, commentCount: 2 })),
  });

  return { observed, service };
}

test("my reviews paginates on the server in groups of six", async () => {
  const { observed, service } = createServiceFixture(7);
  const result = await service({
    email: "traveller@example.com",
    page: 2,
  });

  assert.equal(MY_REVIEWS_PAGE_SIZE, 6);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 6,
    total: 7,
    totalPages: 2,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]._id, "review-7");
  assert.equal(result.items[0].commentCount, 2);
  assert.deepEqual(observed[0], {
    userId: "user-1",
    page: 2,
    limit: 6,
    searchPattern: "",
  });
});

test("my reviews keeps six reviews on one page and preserves like state", async () => {
  const { service } = createServiceFixture(6);
  const result = await service({ email: "traveller@example.com", page: 1 });

  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.items.length, 6);
  assert.equal(result.items[0].likeCount, 1);
  assert.equal(result.items[0].likedByCurrentUser, true);
  assert.equal("likes" in result.items[0], false);
});

test("my reviews escapes search text and clamps an empty last page", async () => {
  const { observed, service } = createServiceFixture(6);
  const result = await service({
    email: "traveller@example.com",
    page: 2,
    search: " museum.* ",
  });

  assert.equal(result.search, "museum.*");
  assert.equal(result.pagination.page, 1);
  assert.equal(observed.length, 2);
  assert.equal(observed[0].searchPattern, "museum\\.\\*");
  assert.equal(observed[1].page, 1);
});

test("my reviews handler returns the pagination contract", async () => {
  const expected = {
    items: [{ _id: "review-1" }],
    search: "museum",
    pagination: { page: 1, limit: 6, total: 1, totalPages: 1 },
  };
  const GET = createMyReviewsHandler({
    authenticate: async () => ({ user: { email: "traveller@example.com" } }),
    connectToDatabase: async () => {},
    getMyReviews: async (input) => {
      assert.deepEqual(input, {
        email: "traveller@example.com",
        page: "1",
        search: "museum",
      });
      return expected;
    },
    ServiceError: class extends Error {},
  });

  const response = await GET(
    new Request("http://localhost/api/my-reviews?page=1&search=museum")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    count: 1,
    data: expected.items,
    search: expected.search,
    pagination: expected.pagination,
  });
});

test("my reviews handler requires an authenticated user", async () => {
  const GET = createMyReviewsHandler({
    authenticate: async () => null,
    connectToDatabase: async () => assert.fail("database should not be called"),
    getMyReviews: async () => assert.fail("service should not be called"),
    ServiceError: class extends Error {},
  });

  const response = await GET(new Request("http://localhost/api/my-reviews"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});
