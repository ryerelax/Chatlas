import assert from "node:assert/strict";
import test from "node:test";
import {
  createVerifiedVisitService,
  VerifiedVisitServiceError,
} from "../src/business/services/verifiedVisitService.js";

const USER_ID = "64b000000000000000000001";
const ATTRACTION_ID = "64b000000000000000000002";
const VISIT_ID = "64b000000000000000000003";
const PHOTO_ID = "64b000000000000000000004";
const GOOGLE_ID = "google-provider-subject";
const NOW = new Date("2026-08-15T16:30:00.000Z");
const PHOTO_URL = "https://res.cloudinary.com/demo/image/upload/verified.jpg";
const CLOUDINARY_PUBLIC_ID = "chatlas/verified-visits/new-private-id";
const JPEG_DATA_URI = "data:image/jpeg;base64,/9j/2Q==";
const METRES_PER_RADIAN = 6371000;

function latitudeOffset(metres) {
  return (metres / METRES_PER_RADIAN) * (180 / Math.PI);
}

function createHarness(overrides = {}) {
  const calls = {
    uploads: [],
    deletes: [],
    appends: [],
    ownershipLookups: [],
    removals: [],
    emptyDeletes: [],
  };
  const user = {
    _id: USER_ID,
    displayName: "Aina",
    name: "Aina Ahmad",
    profilePicture: "https://example.test/aina.jpg",
  };
  const attraction = {
    _id: ATTRACTION_ID,
    latitude: 2,
    longitude: 102,
    state: "Melaka",
    isActive: true,
  };
  const uploaded = {
    photoUrl: PHOTO_URL,
    cloudinaryPublicId: CLOUDINARY_PUBLIC_ID,
  };
  const appendedVisit = {
    _id: VISIT_ID,
    attractionId: ATTRACTION_ID,
    photos: [{
      _id: PHOTO_ID,
      photoUrl: PHOTO_URL,
      capturedAt: NOW,
    }],
  };
  let uuidIndex = 0;
  const uuids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];

  const dependencies = {
    isValidObjectId: (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value),
    now: () => new Date(NOW),
    randomUUID: () => uuids[uuidIndex++] ?? `uuid-${uuidIndex}`,
    findUserByGoogleId: async () => user,
    findAttractionById: async () => attraction,
    uploadVerifiedVisitImage: async (dataUri, options) => {
      calls.uploads.push({ dataUri, options });
      return uploaded;
    },
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
    },
    appendPhotoToDatedVisit: async (input) => {
      calls.appends.push(input);
      return appendedVisit;
    },
    findDistinctVerifiedAttractionIds: async () => [ATTRACTION_ID],
    findPublicVerifiedPhotos: async () => [],
    findOwnedPhotoForDeletion: async (input) => {
      calls.ownershipLookups.push(input);
      return { cloudinaryPublicId: CLOUDINARY_PUBLIC_ID };
    },
    removeOwnedPhoto: async (input) => {
      calls.removals.push(input);
      return { _id: VISIT_ID, photos: [] };
    },
    deleteVisitWhenEmpty: async (visitId) => {
      calls.emptyDeletes.push(visitId);
    },
    ...overrides,
  };

  return {
    calls,
    service: createVerifiedVisitService(dependencies),
  };
}

function validVerifyInput(overrides = {}) {
  return {
    googleId: GOOGLE_ID,
    attractionId: ATTRACTION_ID,
    latitude: 2,
    longitude: 102,
    accuracyMeters: 20,
    photoDataUri: JPEG_DATA_URI,
    ...overrides,
  };
}

async function expectServiceError(operation, { statusCode, message }) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof VerifiedVisitServiceError);
    assert.equal(error.statusCode, statusCode);
    assert.equal(error.message, message);
    return true;
  });
}

test("verify rejects an invalid provider subject before user lookup or upload", async () => {
  let userLookups = 0;
  const { service, calls } = createHarness({
    findUserByGoogleId: async () => {
      userLookups += 1;
      return null;
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ googleId: "   " })),
    { statusCode: 401, message: "A signed-in user account is required." }
  );
  assert.equal(userLookups, 0);
  assert.equal(calls.uploads.length, 0);
});

test("verify rejects an invalid attraction ObjectId before lookup or upload", async () => {
  let attractionLookups = 0;
  const { service, calls } = createHarness({
    findAttractionById: async () => {
      attractionLookups += 1;
      return null;
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ attractionId: "not-an-object-id" })),
    { statusCode: 400, message: "A valid attraction ID is required." }
  );
  assert.equal(attractionLookups, 0);
  assert.equal(calls.uploads.length, 0);
});

test("verify handles a missing persisted user without leaking lookup details", async () => {
  const { service, calls } = createHarness({ findUserByGoogleId: async () => null });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 401, message: "A signed-in user account is required." }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify rejects a missing or inactive Melaka attraction before upload", async () => {
  const { service, calls } = createHarness({ findAttractionById: async () => null });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 404, message: "Attraction not found." }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify rejects malformed and unsupported image data URIs before upload", async (t) => {
  const invalidImages = [
    "",
    "https://example.test/photo.jpg",
    "data:image/gif;base64,R0lGODlh",
    "data:image/jpeg;base64,",
    "data:image/png;base64,not base64!",
    "data:image/webp;base64,AAAA=AAA",
  ];

  for (const photoDataUri of invalidImages) {
    await t.test(photoDataUri || "empty string", async () => {
      const { service, calls } = createHarness();
      await expectServiceError(
        () => service.verifyVisitPhoto(validVerifyInput({ photoDataUri })),
        {
          statusCode: 400,
          message: "A JPEG, PNG, or WebP image up to 5 MiB is required.",
        }
      );
      assert.equal(calls.uploads.length, 0);
    });
  }
});

test("verify accepts exactly 5 MiB decoded image data and rejects one byte more", async () => {
  const exactLimit = `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024).toString("base64")}`;
  const overLimit = `data:image/png;base64,${Buffer.alloc((5 * 1024 * 1024) + 1).toString("base64")}`;
  const accepted = createHarness();
  const rejected = createHarness();

  await accepted.service.verifyVisitPhoto(validVerifyInput({ photoDataUri: exactLimit }));
  assert.equal(accepted.calls.uploads.length, 1);

  await expectServiceError(
    () => rejected.service.verifyVisitPhoto(validVerifyInput({ photoDataUri: overLimit })),
    {
      statusCode: 400,
      message: "A JPEG, PNG, or WebP image up to 5 MiB is required.",
    }
  );
  assert.equal(rejected.calls.uploads.length, 0);
});

test("verify rejects distance above 150 before upload", async () => {
  const { service, calls } = createHarness();

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ latitude: 2 + latitudeOffset(151) })),
    {
      statusCode: 400,
      message: "You must be within 150 metres of the attraction to verify this visit.",
    }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify rejects accuracy above 100 before upload", async () => {
  const { service, calls } = createHarness();

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ accuracyMeters: 101 })),
    { statusCode: 400, message: "Location accuracy must be 100 metres or better." }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify accepts the distance and accuracy boundaries", async () => {
  const { service, calls } = createHarness();

  await service.verifyVisitPhoto(validVerifyInput({
    latitude: 2 + latitudeOffset(149.999),
    accuracyMeters: 100,
  }));

  assert.equal(calls.uploads.length, 1);
  assert.ok(calls.appends[0].photo.distanceMeters <= 150);
  assert.equal(calls.appends[0].photo.accuracyMeters, 100);
});

test("verify rejects non-finite and out-of-range location evidence before upload", async (t) => {
  const invalidEvidence = [
    { latitude: "not-a-number" },
    { latitude: 91 },
    { longitude: -181 },
    { accuracyMeters: -1 },
    { accuracyMeters: Number.POSITIVE_INFINITY },
  ];

  for (const evidence of invalidEvidence) {
    await t.test(JSON.stringify(evidence), async () => {
      const { service, calls } = createHarness();
      await assert.rejects(
        () => service.verifyVisitPhoto(validVerifyInput(evidence)),
        (error) => error instanceof VerifiedVisitServiceError && error.statusCode === 400
      );
      assert.equal(calls.uploads.length, 0);
    });
  }
});

test("verify rejects coercible non-numeric evidence before lookup or upload", async (t) => {
  const invalidValues = [null, "", "   ", true, false];

  for (const field of ["latitude", "longitude", "accuracyMeters"]) {
    for (const value of invalidValues) {
      await t.test(`${field}: ${JSON.stringify(value)}`, async () => {
        let userLookups = 0;
        const { service, calls } = createHarness({
          findUserByGoogleId: async () => {
            userLookups += 1;
            return { _id: USER_ID };
          },
        });

        await assert.rejects(
          () => service.verifyVisitPhoto(validVerifyInput({ [field]: value })),
          (error) => error instanceof VerifiedVisitServiceError && error.statusCode === 400
        );
        assert.equal(userLookups, 0);
        assert.equal(calls.uploads.length, 0);
      });
    }
  }
});

test("verify preserves legitimate numeric zero and non-empty numeric strings", async () => {
  const { service, calls } = createHarness({
    findAttractionById: async () => ({
      _id: ATTRACTION_ID,
      latitude: 0,
      longitude: 0,
      state: "Melaka",
      isActive: true,
    }),
  });

  await service.verifyVisitPhoto(validVerifyInput({
    latitude: "0",
    longitude: 0,
    accuracyMeters: "0",
  }));

  assert.deepEqual(
    {
      latitude: calls.appends[0].photo.latitude,
      longitude: calls.appends[0].photo.longitude,
      accuracyMeters: calls.appends[0].photo.accuracyMeters,
    },
    { latitude: 0, longitude: 0, accuracyMeters: 0 }
  );
});

test("verify creates a new dated photo with server evidence and safe output", async () => {
  const { service, calls } = createHarness();

  const result = await service.verifyVisitPhoto(validVerifyInput({
    latitude: "2",
    longitude: "102",
    accuracyMeters: "20",
    capturedAt: "1999-01-01T00:00:00.000Z",
    visitDateKey: "1999-01-01",
  }));

  assert.deepEqual(result, {
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
    attractionId: ATTRACTION_ID,
    photoUrl: PHOTO_URL,
    capturedDate: NOW.toISOString(),
    verified: true,
  });
  assert.deepEqual(calls.appends, [{
    userId: USER_ID,
    attractionId: ATTRACTION_ID,
    visitDateKey: "2026-08-16",
    photo: {
      photoUrl: PHOTO_URL,
      cloudinaryPublicId: CLOUDINARY_PUBLIC_ID,
      capturedAt: NOW,
      latitude: 2,
      longitude: 102,
      accuracyMeters: 20,
      distanceMeters: 0,
    },
  }]);
  assert.ok(!JSON.stringify(result).includes("cloudinaryPublicId"));
  assert.ok(!JSON.stringify(result).includes("latitude"));
});

test("verify uses opaque collision-resistant upload IDs that cannot leak through delivery URLs", async () => {
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/v1/chatlas/verified-visits/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    appendPhotoToDatedVisit: async (input) => {
      calls.appends.push(input);
      return {
        _id: VISIT_ID,
        photos: [{ _id: PHOTO_ID, photoUrl: input.photo.photoUrl, capturedAt: NOW }],
      };
    },
  });

  const first = await service.verifyVisitPhoto(validVerifyInput());
  const second = await service.verifyVisitPhoto(validVerifyInput());
  const publicIds = calls.uploads.map((call) => call.options.publicId);

  assert.equal(new Set(publicIds).size, 2);
  assert.deepEqual(publicIds, [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ]);
  for (const publicId of publicIds) {
    assert.ok(!publicId.includes(USER_ID));
    assert.ok(!publicId.includes(ATTRACTION_ID));
    assert.ok(!publicId.includes("2026-08-16"));
    assert.ok(!publicId.includes("1786811400000"));
  }
  assert.ok(!first.photoUrl.includes(USER_ID));
  assert.ok(!first.photoUrl.includes(ATTRACTION_ID));
  assert.ok(!JSON.stringify([first, second]).includes(USER_ID));
  assert.ok(!JSON.stringify([first, second]).includes("cloudinaryPublicId"));
});

test("verify cleans a malformed upload result containing only a private asset ID exactly once", async () => {
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, options) => {
      calls.uploads.push({ dataUri, options });
      return { cloudinaryPublicId: CLOUDINARY_PUBLIC_ID };
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.equal(calls.appends.length, 0);
});

test("verify rejects a grossly oversized encoded payload before lookup or upload", async () => {
  const maximumEncodedLength = 4 * Math.ceil((5 * 1024 * 1024) / 3);
  const photoDataUri = `data:image/webp;base64,${"A".repeat(maximumEncodedLength + 4)}`;
  let userLookups = 0;
  const { service, calls } = createHarness({
    findUserByGoogleId: async () => {
      userLookups += 1;
      return { _id: USER_ID };
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ photoDataUri })),
    {
      statusCode: 400,
      message: "A JPEG, PNG, or WebP image up to 5 MiB is required.",
    }
  );
  assert.equal(userLookups, 0);
  assert.equal(calls.uploads.length, 0);
});

test("verify removes the uploaded image exactly once when persistence fails", async () => {
  const { service, calls } = createHarness({
    appendPhotoToDatedVisit: async () => {
      throw new Error("database unavailable: private detail");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
});

test("verify reports the attraction-date group limit and cleans only the new upload once", async () => {
  const oldAsset = "chatlas/verified-visits/existing-private-id";
  const { service, calls } = createHarness({
    appendPhotoToDatedVisit: async () => null,
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
      assert.notEqual(publicId, oldAsset);
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    {
      statusCode: 409,
      message: "You have already added 3 verified photos for this attraction today. You can add more photos on your next visit.",
    }
  );
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
});

test("verify does not retry cleanup when cleanup itself fails", async () => {
  let cleanupAttempts = 0;
  const { service } = createHarness({
    appendPhotoToDatedVisit: async () => null,
    deleteCloudinaryImage: async () => {
      cleanupAttempts += 1;
      throw new Error("Cloudinary unavailable");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.equal(cleanupAttempts, 1);
});

test("visited IDs are distinct across dates and photos", async () => {
  const { service } = createHarness({
    findDistinctVerifiedAttractionIds: async () => [
      ATTRACTION_ID,
      ATTRACTION_ID,
      { toString: () => "64b000000000000000000005" },
    ],
  });

  assert.deepEqual(await service.getVerifiedAttractionIdsForUser(GOOGLE_ID), [
    ATTRACTION_ID,
    "64b000000000000000000005",
  ]);
});

test("visited IDs fail safely instead of reporting a truthful empty list when the user is missing", async () => {
  let distinctQueries = 0;
  const { service } = createHarness({
    findUserByGoogleId: async () => null,
    findDistinctVerifiedAttractionIds: async () => {
      distinctQueries += 1;
      return [ATTRACTION_ID];
    },
  });

  await expectServiceError(
    () => service.getVerifiedAttractionIdsForUser(GOOGLE_ID),
    { statusCode: 401, message: "A signed-in user account is required." }
  );
  assert.equal(distinctQueries, 0);
});

test("public results omit all private fields and expose the exact owner card shape", async () => {
  let receivedViewerId;
  const { service } = createHarness({
    findPublicVerifiedPhotos: async (attractionId, viewerId) => {
      assert.equal(attractionId, ATTRACTION_ID);
      receivedViewerId = viewerId;
      return [{
        _id: VISIT_ID,
        visitDateKey: "2026-08-16",
        createdAt: "2026-08-15T16:30:00.000Z",
        user: {
          displayName: "Aina",
          name: "Private fallback",
          profilePicture: "https://example.test/aina.jpg",
          email: "private@example.test",
          _id: USER_ID,
        },
        canDelete: true,
        photos: [{
          _id: PHOTO_ID,
          photoUrl: PHOTO_URL,
          capturedAt: "2026-08-15T16:30:00.000Z",
          cloudinaryPublicId: CLOUDINARY_PUBLIC_ID,
          latitude: 2,
          longitude: 102,
          accuracyMeters: 20,
          distanceMeters: 0,
        }],
      }];
    },
  });

  const result = await service.getPublicVerifiedPhotos(ATTRACTION_ID, GOOGLE_ID);

  assert.equal(receivedViewerId, USER_ID);
  assert.deepEqual(result, [{
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
    attractionId: ATTRACTION_ID,
    photoUrl: PHOTO_URL,
    capturedDate: "2026-08-15T16:30:00.000Z",
    user: {
      displayName: "Aina",
      avatarUrl: "https://example.test/aina.jpg",
    },
    verified: true,
    canDelete: true,
  }]);
});

test("public cards use safe user fallbacks", async () => {
  const { service } = createHarness({
    findPublicVerifiedPhotos: async () => [{
      _id: VISIT_ID,
      user: { displayName: "", name: "Aina Ahmad", profilePicture: "" },
      canDelete: false,
      photos: [{ _id: PHOTO_ID, photoUrl: PHOTO_URL, capturedAt: NOW }],
    }],
  });

  const [card] = await service.getPublicVerifiedPhotos(ATTRACTION_ID);
  assert.deepEqual(card.user, { displayName: "Aina Ahmad", avatarUrl: "" });
});

test("public results set canDelete for owner, non-owner, anonymous, and unknown viewers", async (t) => {
  const cases = [
    { name: "owner", googleId: GOOGLE_ID, resolvedUser: { _id: USER_ID }, repositoryCanDelete: true, expected: true, viewerId: USER_ID },
    { name: "non-owner", googleId: GOOGLE_ID, resolvedUser: { _id: USER_ID }, repositoryCanDelete: false, expected: false, viewerId: USER_ID },
    { name: "anonymous", googleId: undefined, resolvedUser: null, repositoryCanDelete: false, expected: false, viewerId: undefined },
    { name: "unknown", googleId: GOOGLE_ID, resolvedUser: null, repositoryCanDelete: false, expected: false, viewerId: undefined },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      let actualViewerId;
      const { service } = createHarness({
        findUserByGoogleId: async () => item.resolvedUser,
        findPublicVerifiedPhotos: async (_attractionId, viewerId) => {
          actualViewerId = viewerId;
          return [{
            _id: VISIT_ID,
            user: { displayName: "Aina", name: "Aina", profilePicture: "" },
            canDelete: item.repositoryCanDelete,
            photos: [{ _id: PHOTO_ID, photoUrl: PHOTO_URL, capturedAt: NOW }],
          }];
        },
      });

      const [card] = await service.getPublicVerifiedPhotos(ATTRACTION_ID, item.googleId);
      assert.equal(actualViewerId, item.viewerId);
      assert.equal(card.canDelete, item.expected);
    });
  }
});

test("public photos are flattened and globally sorted newest-first by capturedAt", async () => {
  const { service } = createHarness({
    findPublicVerifiedPhotos: async () => [
      {
        _id: VISIT_ID,
        user: { displayName: "Older group", profilePicture: "" },
        canDelete: false,
        photos: [
          { _id: PHOTO_ID, photoUrl: "https://example.test/oldest.jpg", capturedAt: "2026-08-15T08:00:00.000Z" },
          { _id: "64b000000000000000000006", photoUrl: "https://example.test/newest.jpg", capturedAt: "2026-08-15T12:00:00.000Z" },
        ],
      },
      {
        _id: "64b000000000000000000007",
        user: { displayName: "Newer group", profilePicture: "" },
        canDelete: false,
        photos: [
          { _id: "64b000000000000000000008", photoUrl: "https://example.test/middle.jpg", capturedAt: "2026-08-15T10:00:00.000Z" },
        ],
      },
    ],
  });

  const result = await service.getPublicVerifiedPhotos(ATTRACTION_ID);
  assert.deepEqual(result.map((card) => card.photoUrl), [
    "https://example.test/newest.jpg",
    "https://example.test/middle.jpg",
    "https://example.test/oldest.jpg",
  ]);
});

test("public lookup rejects an invalid attraction ObjectId before repository access", async () => {
  let queries = 0;
  const { service } = createHarness({
    findPublicVerifiedPhotos: async () => {
      queries += 1;
      return [];
    },
  });

  await expectServiceError(
    () => service.getPublicVerifiedPhotos("invalid"),
    { statusCode: 400, message: "A valid attraction ID is required." }
  );
  assert.equal(queries, 0);
});

test("delete requires photo ownership and does not touch Cloudinary for a non-owner", async () => {
  const { service, calls } = createHarness({ findOwnedPhotoForDeletion: async () => null });

  await expectServiceError(
    () => service.deleteOwnedVerifiedPhoto({
      googleId: GOOGLE_ID,
      visitId: VISIT_ID,
      photoId: PHOTO_ID,
    }),
    { statusCode: 403, message: "You can only delete your own verified photos." }
  );
  assert.deepEqual(calls.deletes, []);
  assert.deepEqual(calls.removals, []);
  assert.deepEqual(calls.emptyDeletes, []);
});

test("delete rejects invalid visit and photo ObjectIds before repository access", async (t) => {
  for (const invalidInput of [
    { visitId: "invalid", photoId: PHOTO_ID },
    { visitId: VISIT_ID, photoId: "invalid" },
  ]) {
    await t.test(JSON.stringify(invalidInput), async () => {
      const { service, calls } = createHarness();
      await assert.rejects(
        () => service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, ...invalidInput }),
        (error) => error instanceof VerifiedVisitServiceError && error.statusCode === 400
      );
      assert.deepEqual(calls.ownershipLookups, []);
      assert.deepEqual(calls.removals, []);
    });
  }
});

test("delete safely rejects a missing persisted user", async () => {
  const { service, calls } = createHarness({ findUserByGoogleId: async () => null });

  await expectServiceError(
    () => service.deleteOwnedVerifiedPhoto({
      googleId: GOOGLE_ID,
      visitId: VISIT_ID,
      photoId: PHOTO_ID,
    }),
    { statusCode: 403, message: "You can only delete your own verified photos." }
  );
  assert.deepEqual(calls.ownershipLookups, []);
  assert.deepEqual(calls.removals, []);
});

test("owner deletion follows ownership lookup, Cloudinary, atomic pull, then empty cleanup", async () => {
  const order = [];
  const { service, calls } = createHarness({
    findOwnedPhotoForDeletion: async (input) => {
      order.push("ownership");
      calls.ownershipLookups.push(input);
      return { cloudinaryPublicId: CLOUDINARY_PUBLIC_ID };
    },
    removeOwnedPhoto: async (input) => {
      order.push("repository");
      calls.removals.push(input);
      return { _id: VISIT_ID, photos: [] };
    },
    deleteCloudinaryImage: async (publicId) => {
      order.push("cloudinary");
      calls.deletes.push(publicId);
    },
    deleteVisitWhenEmpty: async (visitId) => {
      order.push("empty-group");
      calls.emptyDeletes.push(visitId);
    },
  });

  const result = await service.deleteOwnedVerifiedPhoto({
    googleId: GOOGLE_ID,
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
  });

  assert.equal(result, undefined);
  assert.deepEqual(order, ["ownership", "cloudinary", "repository", "empty-group"]);
  assert.deepEqual(calls.ownershipLookups, [{ userId: USER_ID, visitId: VISIT_ID, photoId: PHOTO_ID }]);
  assert.deepEqual(calls.removals, [{ userId: USER_ID, visitId: VISIT_ID, photoId: PHOTO_ID }]);
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.deepEqual(calls.emptyDeletes, [VISIT_ID]);
});

test("owner deletion keeps a non-empty visit group after deleting its Cloudinary asset", async () => {
  const { service, calls } = createHarness({
    removeOwnedPhoto: async () => ({
      _id: VISIT_ID,
      photos: [{ _id: "64b000000000000000000009" }],
    }),
  });

  await service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID });
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.deepEqual(calls.emptyDeletes, []);
});

test("Cloudinary deletion failure preserves database evidence so the operation can be retried", async () => {
  let evidencePresent = true;
  const { service, calls } = createHarness({
    findOwnedPhotoForDeletion: async (input) => {
      calls.ownershipLookups.push(input);
      return evidencePresent ? { cloudinaryPublicId: CLOUDINARY_PUBLIC_ID } : null;
    },
    removeOwnedPhoto: async (input) => {
      evidencePresent = false;
      calls.removals.push(input);
      return { _id: VISIT_ID, photos: [] };
    },
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
      throw new Error("Cloudinary private failure");
    },
  });

  await expectServiceError(
    () => service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID }),
    { statusCode: 500, message: "Unable to delete the verified visit photo." }
  );
  assert.equal(evidencePresent, true);
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.deepEqual(calls.removals, []);
  assert.deepEqual(calls.emptyDeletes, []);
});

test("owner deletion safely handles ownership lookup and post-Cloudinary pull failures", async (t) => {
  await t.test("ownership lookup failure", async () => {
    const { service, calls } = createHarness({
      findOwnedPhotoForDeletion: async () => {
        throw new Error("database private failure");
      },
    });
    await expectServiceError(
      () => service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID }),
      { statusCode: 500, message: "Unable to delete the verified visit photo." }
    );
    assert.deepEqual(calls.deletes, []);
    assert.deepEqual(calls.removals, []);
  });

  await t.test("atomic pull failure after an idempotent asset deletion", async () => {
    const { service, calls } = createHarness({
      removeOwnedPhoto: async () => {
        throw new Error("database private failure");
      },
    });
    await expectServiceError(
      () => service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID }),
      { statusCode: 500, message: "Unable to delete the verified visit photo." }
    );
    assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
    assert.deepEqual(calls.emptyDeletes, []);
  });
});

test("empty-group cleanup failure does not make a completed photo deletion untruthful", async () => {
  const { service, calls } = createHarness({
    deleteVisitWhenEmpty: async (visitId) => {
      calls.emptyDeletes.push(visitId);
      throw new Error("database private failure");
    },
  });

  const result = await service.deleteOwnedVerifiedPhoto({
    googleId: GOOGLE_ID,
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
  });

  assert.equal(result, undefined);
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.equal(calls.removals.length, 1);
  assert.deepEqual(calls.emptyDeletes, [VISIT_ID]);
});
