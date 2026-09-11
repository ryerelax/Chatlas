import assert from "node:assert/strict";
import test from "node:test";
import { createMyFavouritesHandler } from "../src/app/api/my-favourites/handler.js";
import {
  createMyFavouritesService,
  MY_FAVOURITES_PAGE_SIZE,
} from "../src/business/services/myFavouritesService.js";

function createFavourite(index) {
  return {
    _id: `favourite-${index}`,
    addedAt: new Date(2026, 0, index),
    attractionId: {
      _id: `attraction-${index}`,
      name: `Attraction ${index}`,
      category: "Museum",
      address: `Address ${index}`,
      rating: 4.5,
      photos: [`photo-${index}.jpg`],
    },
  };
}

function createServiceFixture(total = 10) {
  const favourites = Array.from({ length: total }, (_, index) =>
    createFavourite(index + 1)
  );
  const observed = { page: null, limit: null, userId: null };
  const service = createMyFavouritesService({
    countFavourites: async () => total,
    findFavourites: async ({ userId, page, limit }) => {
      observed.userId = userId;
      observed.page = page;
      observed.limit = limit;
      return favourites.slice((page - 1) * limit, page * limit);
    },
  });

  return { observed, service };
}

test("my favourites paginates on the server in groups of nine", async () => {
  const { observed, service } = createServiceFixture(10);
  const result = await service({ userId: "google-1", page: 2 });

  assert.equal(MY_FAVOURITES_PAGE_SIZE, 9);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 9,
    total: 10,
    totalPages: 2,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]._id, "favourite-10");
  assert.equal(result.items[0].attractionId._id, "attraction-10");
  assert.deepEqual(observed, { userId: "google-1", page: 2, limit: 9 });
});

test("my favourites keeps nine attractions on one page", async () => {
  const { service } = createServiceFixture(9);
  const result = await service({ userId: "google-1", page: 1 });

  assert.equal(result.items.length, 9);
  assert.equal(result.pagination.totalPages, 1);
});

test("my favourites clamps the page after removing the last page item", async () => {
  const { observed, service } = createServiceFixture(9);
  const result = await service({ userId: "google-1", page: 2 });

  assert.equal(result.pagination.page, 1);
  assert.equal(observed.page, 1);
});

test("my favourites handler returns the pagination contract", async () => {
  const expected = {
    items: [{ _id: "favourite-1" }],
    pagination: { page: 1, limit: 9, total: 1, totalPages: 1 },
  };
  const GET = createMyFavouritesHandler({
    authenticate: async () => ({
      user: { id: "database-user-1", googleId: "google-1" },
    }),
    connectToDatabase: async () => {},
    getMyFavourites: async (input) => {
      assert.deepEqual(input, { userId: "database-user-1", page: "1" });
      return expected;
    },
    ServiceError: class extends Error {},
  });

  const response = await GET(
    new Request("http://localhost/api/my-favourites?page=1")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    count: 1,
    data: expected.items,
    pagination: expected.pagination,
  });
});

test("my favourites handler requires an authenticated user", async () => {
  const GET = createMyFavouritesHandler({
    authenticate: async () => null,
    connectToDatabase: async () => assert.fail("database should not be called"),
    getMyFavourites: async () => assert.fail("service should not be called"),
    ServiceError: class extends Error {},
  });

  const response = await GET(new Request("http://localhost/api/my-favourites"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});
