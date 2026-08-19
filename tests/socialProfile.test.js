import assert from "node:assert/strict";
import test from "node:test";
import { createProfilesHandler } from "../src/app/api/profiles/handler.js";
import { createPublicProfileReviewsService } from "../src/business/services/socialProfileService.js";
import { createSocialProfileUserService } from "../src/business/services/userService.js";
import { createPublicReviewRepository } from "../src/data/repositories/reviewRepository.js";
import { createPublicUserRepository } from "../src/data/repositories/userRepository.js";

test("public profile repository searches safe public fields and excludes the viewer", async () => {
  const observed = {};
  const records = [{ _id: "profile-one" }];
  const queryBuilder = {
    select(fields) {
      observed.fields = fields;
      return this;
    },
    sort(sort) {
      observed.sort = sort;
      return this;
    },
    skip(skip) {
      observed.skip = skip;
      return this;
    },
    limit(limit) {
      observed.limit = limit;
      return this;
    },
    lean() {
      return records;
    },
  };
  const repository = createPublicUserRepository({
    UserModel: {
      find(query) {
        observed.query = query;
        return queryBuilder;
      },
      countDocuments(query) {
        observed.countQuery = query;
        return 1;
      },
    },
  });

  const result = await repository.findPublicUsers({
    searchPattern: "Melaka",
    excludedGoogleId: "viewer-google-id",
    page: 2,
    limit: 12,
  });

  assert.deepEqual(result, { items: records, total: 1 });
  assert.deepEqual(observed.query, {
    $or: [
      { displayName: { $regex: "Melaka", $options: "i" } },
      { name: { $regex: "Melaka", $options: "i" } },
      { location: { $regex: "Melaka", $options: "i" } },
    ],
    googleId: { $ne: "viewer-google-id" },
  });
  assert.deepEqual(observed.countQuery, observed.query);
  assert.equal(
    observed.fields,
    "_id name displayName profilePicture bio location joinedAt createdAt"
  );
  assert.deepEqual(observed.sort, { displayName: 1, name: 1, _id: 1 });
  assert.equal(observed.skip, 12);
  assert.equal(observed.limit, 12);
});

test("social profile service normalizes paging and exposes public fields only", async () => {
  const observed = {};
  const service = createSocialProfileUserService({
    findPublicUsers: async (options) => {
      observed.options = options;
      return {
        items: [
          {
            _id: "507f1f77bcf86cd799439011",
            name: "Google Name",
            displayName: "  Melaka Traveller  ",
            email: "private@example.com",
            googleId: "private-google-id",
            profilePicture: "https://example.com/avatar.jpg",
            bio: "  Loves museums  ",
            location: "  Melaka  ",
            joinedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
        total: 13,
      };
    },
    findPublicUserById: async () => null,
    findUserByIdentity: async () => null,
    isValidObjectId: () => true,
  });

  const result = await service.getPublicProfiles({
    search: "  museum.*  ",
    page: -4,
    excludedGoogleId: "viewer-id",
  });

  assert.deepEqual(observed.options, {
    searchPattern: "museum\\.\\*",
    excludedGoogleId: "viewer-id",
    page: 1,
    limit: 12,
  });
  assert.equal(result.totalPages, 2);
  assert.deepEqual(result.items[0], {
    id: "507f1f77bcf86cd799439011",
    displayName: "Melaka Traveller",
    profilePicture: "https://example.com/avatar.jpg",
    bio: "Loves museums",
    location: "Melaka",
    joinedAt: "2026-01-02T00:00:00.000Z",
    activitySummary: {
      reviewsWritten: null,
      visitedAttractions: null,
      explorationProgress: null,
      status: "unavailable",
    },
  });
  assert.equal("email" in result.items[0], false);
  assert.equal("googleId" in result.items[0], false);
});

test("social profile service rejects invalid profile ids before querying", async () => {
  let queried = false;
  const service = createSocialProfileUserService({
    findPublicUsers: async () => ({ items: [], total: 0 }),
    findPublicUserById: async () => {
      queried = true;
      return null;
    },
    findUserByIdentity: async () => null,
    isValidObjectId: () => false,
  });

  assert.equal(await service.getPublicProfileById("not-an-object-id"), null);
  assert.equal(queried, false);
});

test("social profile service returns a selected public profile without private identity fields", async () => {
  const service = createSocialProfileUserService({
    findPublicUsers: async () => ({ items: [], total: 0 }),
    findPublicUserById: async () => ({
      _id: "507f1f77bcf86cd799439011",
      name: "Public Name",
      email: "private@example.com",
      googleId: "private-google-id",
      profilePicture: "",
      bio: "Museum explorer",
      location: "Melaka",
      createdAt: new Date("2026-02-03T00:00:00.000Z"),
    }),
    findUserByIdentity: async () => null,
    isValidObjectId: () => true,
  });

  const profile = await service.getPublicProfileById(
    "507f1f77bcf86cd799439011"
  );

  assert.equal(profile.id, "507f1f77bcf86cd799439011");
  assert.equal(profile.displayName, "Public Name");
  assert.equal(profile.joinedAt, "2026-02-03T00:00:00.000Z");
  assert.equal("email" in profile, false);
  assert.equal("googleId" in profile, false);
});

test("profiles API returns the public directory contract", async () => {
  let connected = false;
  const observed = {};
  const handler = createProfilesHandler({
    authenticate: async () => ({
      user: {
        id: "507f1f77bcf86cd799439011",
        googleId: "viewer-google-id",
      },
    }),
    connectToDatabase: async () => {
      connected = true;
    },
    getPublicProfiles: async (options) => {
      observed.options = options;
      return {
        items: [{ id: "profile-one" }],
        total: 1,
        page: 2,
        limit: 12,
        totalPages: 3,
      };
    },
  });

  const response = await handler(
    new Request("http://localhost/api/profiles?search=Melaka&page=2")
  );

  assert.equal(connected, true);
  assert.equal(response.status, 200);
  assert.deepEqual(observed.options, {
    search: "Melaka",
    page: "2",
    excludedGoogleId: "viewer-google-id",
  });
  assert.deepEqual(await response.json(), {
    success: true,
    count: 1,
    data: [{ id: "profile-one" }],
    pagination: { page: 2, limit: 12, total: 1, totalPages: 3 },
  });
});

test("profiles API returns a safe error when a dependency fails", async () => {
  const reportedErrors = [];
  const handler = createProfilesHandler({
    authenticate: async () => null,
    connectToDatabase: async () => {
      throw new Error("private database details");
    },
    getPublicProfiles: async () => ({ items: [], total: 0 }),
    reportError: (...args) => reportedErrors.push(args),
  });

  const response = await handler(new Request("http://localhost/api/profiles"));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "Failed to retrieve public profiles.",
  });
  assert.equal(reportedErrors.length, 1);
});

test("public review repository reads one user's reviews without private user fields", async () => {
  const observed = {};
  const records = [{ _id: "review-one" }];
  const queryBuilder = {
    select(fields) {
      observed.fields = fields;
      return this;
    },
    populate(path, fields) {
      observed.populate = { path, fields };
      return this;
    },
    sort(sort) {
      observed.sort = sort;
      return this;
    },
    lean() {
      return records;
    },
  };
  const repository = createPublicReviewRepository({
    ReviewModel: {
      find(query) {
        observed.query = query;
        return queryBuilder;
      },
    },
  });

  const result = await repository.findPublicReviewsByUserId(
    "507f1f77bcf86cd799439011"
  );

  assert.deepEqual(result, records);
  assert.deepEqual(observed.query, {
    userId: "507f1f77bcf86cd799439011",
  });
  assert.equal(
    observed.fields,
    "_id attractionId rating reviewText photos createdAt"
  );
  assert.deepEqual(observed.populate, {
    path: "attractionId",
    fields: "_id name",
  });
  assert.deepEqual(observed.sort, { createdAt: -1, _id: -1 });
});

test("public profile reviews service maps Review data to the profile UI contract", async () => {
  const observed = {};
  const getReviews = createPublicProfileReviewsService({
    getPublicProfileById: async (userId) => {
      observed.requestedProfileId = userId;
      return { id: "507f1f77bcf86cd799439011" };
    },
    findPublicReviewsByUserId: async (userId) => {
      observed.requestedReviewUserId = userId;
      return [
        {
          _id: "507f1f77bcf86cd799439012",
          userId: "private-user-id",
          rating: 5,
          reviewText: "  A memorable visit.  ",
          photos: [
            { url: "https://example.com/photo.jpg", publicId: "private-id" },
            { url: "" },
          ],
          createdAt: new Date("2026-03-04T00:00:00.000Z"),
          attractionId: {
            _id: "507f1f77bcf86cd799439013",
            name: "Melaka Museum",
            address: "Private repository field",
          },
        },
      ];
    },
  });

  const reviews = await getReviews("selected-profile-id");

  assert.equal(observed.requestedProfileId, "selected-profile-id");
  assert.equal(
    observed.requestedReviewUserId,
    "507f1f77bcf86cd799439011"
  );
  assert.deepEqual(reviews, [
    {
      id: "507f1f77bcf86cd799439012",
      rating: 5,
      text: "A memorable visit.",
      photos: ["https://example.com/photo.jpg"],
      createdAt: "2026-03-04T00:00:00.000Z",
      attraction: {
        id: "507f1f77bcf86cd799439013",
        name: "Melaka Museum",
      },
    },
  ]);
  assert.equal("userId" in reviews[0], false);
});

test("public profile reviews service distinguishes missing profiles from no reviews", async () => {
  let repositoryCalls = 0;
  const missingProfileReviews = createPublicProfileReviewsService({
    getPublicProfileById: async () => null,
    findPublicReviewsByUserId: async () => {
      repositoryCalls += 1;
      return [];
    },
  });

  assert.equal(await missingProfileReviews("missing-profile"), null);
  assert.equal(repositoryCalls, 0);

  const emptyProfileReviews = createPublicProfileReviewsService({
    getPublicProfileById: async () => ({ id: "existing-profile" }),
    findPublicReviewsByUserId: async () => [],
  });

  assert.deepEqual(await emptyProfileReviews("existing-profile"), []);
});
