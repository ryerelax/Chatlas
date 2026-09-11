import assert from "node:assert/strict";
import test from "node:test";
import { createTravelHistoryHandler } from "../src/app/api/travel-history/handler.js";
import {
  createTravelHistoryService,
  TRAVEL_HISTORY_PAGE_SIZE,
} from "../src/business/services/travelHistoryService.js";

function createHistoryFixture(count = 10) {
  const ids = Array.from({ length: count }, (_, index) =>
    `attraction-${String(index + 1).padStart(2, "0")}`
  );
  const reviewSummaries = ids.map((id, index) => ({
    _id: id,
    firstReviewDate: new Date(2026, 0, index + 1),
    lastReviewDate: new Date(2026, 0, index + 1),
    reviewCount: 1,
    photoCount: 2,
  }));
  const verifiedVisitSummaries = ids.slice(0, 9).map((id, index) => ({
    _id: id,
    latestVisitedDate: `2026-01-${String(index + 1).padStart(2, "0")}`,
    latestVerifiedAt: new Date(2026, 0, index + 1),
  }));
  const attractions = ids.map((id, index) => ({
    _id: id,
    name: `Attraction ${String(index + 1).padStart(2, "0")}`,
    category: index === 0 ? "Museum" : "Nature",
    state: "Melaka",
    isActive: true,
    photos: [`photo-${index + 1}.jpg`],
    address: `Address ${index + 1}`,
    rating: 4,
    description: `Description ${index + 1}`,
  }));

  return { ids, reviewSummaries, verifiedVisitSummaries, attractions };
}

function createServiceFixture(count = 10) {
  const fixture = createHistoryFixture(count);
  const observed = { detailIds: [], reviewIds: [] };
  const service = createTravelHistoryService({
    findUser: async () => ({ _id: "user-1" }),
    findReviewSummaries: async () => fixture.reviewSummaries,
    findVerifiedVisitSummaries: async () => fixture.verifiedVisitSummaries,
    findAttractionSummaries: async () => fixture.attractions,
    findAttractionDetails: async (ids) => {
      observed.detailIds = ids;
      return fixture.attractions.filter((attraction) =>
        ids.includes(attraction._id)
      );
    },
    findReviewsForAttractions: async (_userId, ids) => {
      observed.reviewIds = ids;
      return ids.map((attractionId) => ({
        _id: `review-${attractionId}`,
        attractionId,
        rating: 5,
        reviewText: "Review",
        userName: "Traveller",
        userAvatar: "",
        photos: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }));
    },
  });

  return { fixture, observed, service };
}

test("travel history paginates attractions on the server in groups of eight", async () => {
  const { observed, service } = createServiceFixture(10);
  const result = await service({ page: 2, sort: "newest" });

  assert.equal(TRAVEL_HISTORY_PAGE_SIZE, 8);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 8,
    total: 10,
    totalPages: 2,
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["attraction-02", "attraction-01"]
  );
  assert.deepEqual(observed.detailIds, ["attraction-02", "attraction-01"]);
  assert.deepEqual(observed.reviewIds, ["attraction-02", "attraction-01"]);
  assert.deepEqual(result.stats, {
    placesVisited: 9,
    reviewsWritten: 10,
    photosUploaded: 20,
  });
});

test("travel history applies search and sort before pagination", async () => {
  const { service } = createServiceFixture(10);
  const result = await service({
    page: 3,
    search: "museum",
    sort: "oldest",
  });

  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.pagination.total, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["attraction-01"]);
});

test("travel history keeps eight attractions on one page", async () => {
  const { service } = createServiceFixture(8);
  const result = await service({ page: 1 });

  assert.equal(result.items.length, 8);
  assert.equal(result.pagination.totalPages, 1);
});

test("travel history handler returns the pagination contract", async () => {
  const expected = {
    items: [{ id: "attraction-1" }],
    stats: { placesVisited: 1, reviewsWritten: 1, photosUploaded: 0 },
    pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
  };
  const GET = createTravelHistoryHandler({
    authenticate: async () => ({
      user: { id: "google-1", email: "traveller@example.com" },
    }),
    connectToDatabase: async () => {},
    getTravelHistory: async (input) => {
      assert.deepEqual(input, {
        identity: {
          googleId: "google-1",
          email: "traveller@example.com",
        },
        page: "1",
        search: "museum",
        sort: "oldest",
      });
      return expected;
    },
    ServiceError: class extends Error {},
  });

  const response = await GET(
    new Request(
      "http://localhost/api/travel-history?page=1&search=museum&sort=oldest"
    )
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    count: 1,
    data: expected.items,
    stats: expected.stats,
    pagination: expected.pagination,
  });
});

test("travel history handler requires an authenticated user", async () => {
  const GET = createTravelHistoryHandler({
    authenticate: async () => null,
    connectToDatabase: async () => {
      assert.fail("database should not be called");
    },
    getTravelHistory: async () => {
      assert.fail("service should not be called");
    },
    ServiceError: class extends Error {},
  });

  const response = await GET(new Request("http://localhost/api/travel-history"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});
