import assert from "node:assert/strict";
import test from "node:test";
import { createMyPhotosHandler } from "../src/app/api/my-photos/handler.js";
import {
  createMyPhotosService,
  MY_PHOTOS_PAGE_SIZE,
} from "../src/business/services/myPhotosService.js";

function createPhoto(index) {
  return {
    reviewId: `review-${index}`,
    attractionId: `attraction-${index}`,
    attractionName: `Attraction ${index}`,
    url: `https://example.com/photo-${index}.jpg`,
    publicId: `photo-${index}`,
    uploadedAt: new Date(2026, 0, index),
    photoIndex: 0,
  };
}

function createServiceFixture(total = 13) {
  const allPhotos = Array.from({ length: total }, (_, index) =>
    createPhoto(index + 1)
  );
  const observed = { page: null, limit: null };
  const service = createMyPhotosService({
    findUser: async () => ({
      _id: "user-1",
      profilePicture: allPhotos[0]?.url || "",
    }),
    countPhotos: async () => total,
    findPhotos: async ({ page, limit }) => {
      observed.page = page;
      observed.limit = limit;
      return allPhotos.slice((page - 1) * limit, page * limit);
    },
    findProfilePhoto: async () => allPhotos[0] || null,
  });

  return { observed, service };
}

test("my photos paginates review photos on the server in groups of twelve", async () => {
  const { observed, service } = createServiceFixture(13);
  const result = await service({ page: 2 });

  assert.equal(MY_PHOTOS_PAGE_SIZE, 12);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 12,
    total: 13,
    totalPages: 2,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].publicId, "photo-13");
  assert.deepEqual(observed, { page: 2, limit: 12 });
  assert.equal(result.profilePhoto.isProfilePicture, true);
});

test("my photos keeps twelve photos on one page", async () => {
  const { service } = createServiceFixture(12);
  const result = await service({ page: 1 });

  assert.equal(result.items.length, 12);
  assert.equal(result.pagination.totalPages, 1);
});

test("my photos clamps an empty last page after a deletion", async () => {
  const { observed, service } = createServiceFixture(12);
  const result = await service({ page: 2 });

  assert.equal(result.pagination.page, 1);
  assert.equal(observed.page, 1);
});

test("my photos handler returns the pagination contract", async () => {
  const expected = {
    items: [{ id: "review-1-0" }],
    profilePhoto: { id: "review-1-0" },
    pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  };
  const GET = createMyPhotosHandler({
    authenticate: async () => ({
      user: { id: "google-1", email: "traveller@example.com" },
    }),
    connectToDatabase: async () => {},
    getMyPhotos: async (input) => {
      assert.deepEqual(input, {
        identity: {
          googleId: "google-1",
          email: "traveller@example.com",
        },
        page: "1",
      });
      return expected;
    },
    ServiceError: class extends Error {},
  });

  const response = await GET(new Request("http://localhost/api/my-photos?page=1"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    count: 1,
    data: expected.items,
    profilePhoto: expected.profilePhoto,
    pagination: expected.pagination,
  });
});

test("my photos handler requires an authenticated user", async () => {
  const GET = createMyPhotosHandler({
    authenticate: async () => null,
    connectToDatabase: async () => assert.fail("database should not be called"),
    getMyPhotos: async () => assert.fail("service should not be called"),
    ServiceError: class extends Error {},
  });

  const response = await GET(new Request("http://localhost/api/my-photos"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});
