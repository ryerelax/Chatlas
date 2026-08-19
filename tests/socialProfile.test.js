import assert from "node:assert/strict";
import test from "node:test";
import { createProfilesHandler } from "../src/app/api/profiles/handler.js";
import {
  buildExplorationComparison,
  createPublicExplorationComparisonService,
  createPublicProfileExplorationService,
  createPublicProfileReviewsService,
  SocialProfileDependencyError,
} from "../src/business/services/socialProfileService.js";
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

test("public review repository derives distinct visited attraction ids for one user", async () => {
  const observed = {};
  const repository = createPublicReviewRepository({
    ReviewModel: {
      distinct(field, query) {
        observed.field = field;
        observed.query = query;
        return ["attraction-one", "attraction-two"];
      },
    },
  });

  const result = await repository.findReviewedAttractionIdsByUserId(
    "507f1f77bcf86cd799439011"
  );

  assert.deepEqual(result, ["attraction-one", "attraction-two"]);
  assert.equal(observed.field, "attractionId");
  assert.deepEqual(observed.query, {
    userId: "507f1f77bcf86cd799439011",
  });
});

test("public profile exploration uses reviewed attractions as visited map locations", async () => {
  const observed = {};
  const getExploration = createPublicProfileExplorationService({
    getPublicProfileById: async (userId) => {
      observed.requestedProfileId = userId;
      return { id: "507f1f77bcf86cd799439011" };
    },
    getExplorationMapAttractions: async () => [
      {
        _id: "507f1f77bcf86cd799439021",
        name: "Visited Museum",
        address: "Museum Street",
        category: "Museum",
        latitude: 2.2,
        longitude: 102.2,
        rating: 4.5,
      },
      {
        _id: "507f1f77bcf86cd799439022",
        name: "Unvisited Gallery",
        address: "Gallery Street",
        category: "Gallery",
        latitude: 2.3,
        longitude: 102.3,
        rating: 4,
      },
    ],
    findReviewedAttractionIdsByUserId: async (userId) => {
      observed.requestedReviewUserId = userId;
      return ["507f1f77bcf86cd799439021"];
    },
  });

  const exploration = await getExploration("selected-profile-id");

  assert.equal(observed.requestedProfileId, "selected-profile-id");
  assert.equal(
    observed.requestedReviewUserId,
    "507f1f77bcf86cd799439011"
  );
  assert.deepEqual(exploration, {
    visitedAttractions: [
      {
        id: "507f1f77bcf86cd799439021",
        name: "Visited Museum",
        address: "Museum Street",
        category: "Museum",
        latitude: 2.2,
        longitude: 102.2,
      },
    ],
    visitedCount: 1,
    totalAttractions: 2,
    progressPercentage: 50,
  });
});

test("public profile exploration returns a truthful zero progress state", async () => {
  const getExploration = createPublicProfileExplorationService({
    getPublicProfileById: async () => ({ id: "existing-profile" }),
    getExplorationMapAttractions: async () => [
      {
        _id: "507f1f77bcf86cd799439021",
        name: "Museum",
        address: "Museum Street",
        category: "Museum",
        latitude: 2.2,
        longitude: 102.2,
      },
    ],
    findReviewedAttractionIdsByUserId: async () => [],
  });

  assert.deepEqual(await getExploration("existing-profile"), {
    visitedAttractions: [],
    visitedCount: 0,
    totalAttractions: 1,
    progressPercentage: 0,
  });
});

test("public profile exploration does not query map data for a missing profile", async () => {
  let dependencyCalls = 0;
  const getExploration = createPublicProfileExplorationService({
    getPublicProfileById: async () => null,
    getExplorationMapAttractions: async () => {
      dependencyCalls += 1;
      return [];
    },
    findReviewedAttractionIdsByUserId: async () => {
      dependencyCalls += 1;
      return [];
    },
  });

  assert.equal(await getExploration("missing-profile"), null);
  assert.equal(dependencyCalls, 0);
});

test("public exploration comparison groups common and unique reviewed attractions", async () => {
  const observedUserIds = [];
  const compareExploration = createPublicExplorationComparisonService({
    getPublicProfileById: async (userId) => {
      assert.equal(userId, "target-request-id");
      return { id: "target-user-id" };
    },
    getExplorationMapAttractions: async () => [
      {
        _id: "common-attraction",
        name: "Common Museum",
        address: "Common Street",
        category: "Museum",
        latitude: 2.2,
        longitude: 102.2,
      },
      {
        _id: "viewer-attraction",
        name: "Viewer Gallery",
        address: "Viewer Street",
        category: "Gallery",
        latitude: 2.3,
        longitude: 102.3,
      },
      {
        _id: "target-attraction",
        name: "Target Park",
        address: "Target Street",
        category: "Park",
        latitude: 2.4,
        longitude: 102.4,
      },
      {
        _id: "unvisited-attraction",
        name: "Unvisited Place",
        address: "Unvisited Street",
        category: "Attraction",
        latitude: 2.5,
        longitude: 102.5,
      },
    ],
    findReviewedAttractionIdsByUserId: async (userId) => {
      observedUserIds.push(userId);
      return userId === "viewer-user-id"
        ? ["common-attraction", "viewer-attraction"]
        : ["common-attraction", "target-attraction"];
    },
  });

  const comparison = await compareExploration(
    "viewer-user-id",
    "target-request-id"
  );

  assert.deepEqual(observedUserIds, ["viewer-user-id", "target-user-id"]);
  assert.deepEqual(comparison.viewer, {
    visitedCount: 2,
    progressPercentage: 50,
  });
  assert.deepEqual(comparison.target, {
    visitedCount: 2,
    progressPercentage: 50,
  });
  assert.deepEqual(
    comparison.common.map((attraction) => attraction.id),
    ["common-attraction"]
  );
  assert.deepEqual(
    comparison.viewerOnly.map((attraction) => attraction.id),
    ["viewer-attraction"]
  );
  assert.deepEqual(
    comparison.targetOnly.map((attraction) => attraction.id),
    ["target-attraction"]
  );
  assert.equal(comparison.common[0].address, "Common Street");
});

test("public exploration comparison keeps one decimal place of progress precision", () => {
  const comparison = buildExplorationComparison({
    viewerAttractions: [{ id: "visited-attraction", name: "Museum" }],
    targetAttractions: [],
    totalAttractions: 41,
  });

  assert.equal(comparison.viewer.progressPercentage, 2.4);
  assert.equal(comparison.target.progressPercentage, 0);
});

test("public exploration comparison stops before dependencies for a missing target", async () => {
  let dependencyCalls = 0;
  const compareExploration = createPublicExplorationComparisonService({
    getPublicProfileById: async () => null,
    getExplorationMapAttractions: async () => {
      dependencyCalls += 1;
      return [];
    },
    findReviewedAttractionIdsByUserId: async () => {
      dependencyCalls += 1;
      return [];
    },
  });

  assert.equal(await compareExploration("viewer", "missing"), null);
  assert.equal(dependencyCalls, 0);
});

test("public exploration comparison rejects comparison with the signed-in user", async () => {
  let dependencyCalls = 0;
  const compareExploration = createPublicExplorationComparisonService({
    getPublicProfileById: async () => ({ id: "same-user-id" }),
    getExplorationMapAttractions: async () => {
      dependencyCalls += 1;
      return [];
    },
    findReviewedAttractionIdsByUserId: async () => {
      dependencyCalls += 1;
      return [];
    },
  });

  await assert.rejects(
    () => compareExploration("same-user-id", "same-user-id"),
    (error) =>
      error instanceof SocialProfileDependencyError &&
      error.code === "SELF_COMPARISON_NOT_ALLOWED"
  );
  assert.equal(dependencyCalls, 0);
});
