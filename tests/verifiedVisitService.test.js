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
const BATCH_SIZE_MESSAGE = "Add exactly one verified visit photo.";
const CAPACITY_MESSAGE =
  "You have already verified this attraction today. You can add a new photo on another Malaysia date.";
const SUBMISSION_KEY = "11111111-1111-4111-8111-111111111111";
const METRES_PER_RADIAN = 6371000;

function latitudeOffset(metres) {
  return (metres / METRES_PER_RADIAN) * (180 / Math.PI);
}

function createHarness(overrides = {}) {
  const calls = {
    uploads: [],
    deletes: [],
    appends: [],
    photoCounts: [],
    submissionLookups: [],
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
    category: "Gallery",
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
    findAttractionByIdForVerifiedVisit: async () => attraction,
    uploadVerifiedVisitImage: async (dataUri, options) => {
      calls.uploads.push({ dataUri, options });
      return uploaded;
    },
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      if (input.photos.length === 1) return appendedVisit;
      return {
        ...appendedVisit,
        photos: input.photos.map((savedPhoto, index) => ({
          _id: index === 0 ? PHOTO_ID : `photo-${index + 1}`,
          photoUrl: savedPhoto.photoUrl,
          capturedAt: savedPhoto.capturedAt,
        })),
      };
    },
    findDatedVisitPhotoCount: async (input) => {
      calls.photoCounts.push(input);
      return 0;
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return null;
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

test("private verified-attraction DTO exposes only compatible date fields and canonical latestVerifiedAt ISO metadata", async () => {
  const { service } = createHarness({
    findVerifiedAttractionsWithLatestVisitDate: async () => [
      {
        attractionId: ATTRACTION_ID,
        latestVisitedDate: "2026-08-23",
        latestVerifiedAt: new Date("2026-08-23T09:08:00.000Z"),
        userId: USER_ID,
        latitude: 2.193,
        accuracyMeters: 12,
        distanceMeters: 34,
        cloudinaryPublicId: CLOUDINARY_PUBLIC_ID,
        submissionKey: SUBMISSION_KEY,
        photoUrl: PHOTO_URL,
      },
      {
        attractionId: "64b000000000000000000009",
        latestVisitedDate: "2026-08-20",
      },
    ],
  });

  assert.deepEqual(await service.getVerifiedAttractionsForUser(GOOGLE_ID), [
    {
      attractionId: ATTRACTION_ID,
      latestVisitedDate: "2026-08-23",
      latestVerifiedAt: "2026-08-23T09:08:00.000Z",
    },
    {
      attractionId: "64b000000000000000000009",
      latestVisitedDate: "2026-08-20",
    },
  ]);
});

function validBatchInput(photoCount, overrides = {}) {
  const { photoDataUri, photoDataUris, ...batchOverrides } = overrides;
  return {
    ...validVerifyInput(batchOverrides),
    photoDataUris: photoDataUris
      ?? Array.from({ length: photoCount }, () => photoDataUri ?? JPEG_DATA_URI),
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
    findAttractionByIdForVerifiedVisit: async () => {
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

test("verify rejects missing, inactive, and unsupported attractions before upload", async (t) => {
  const rejectedAttractions = [
    ["missing", null],
    ["inactive", { _id: ATTRACTION_ID, latitude: 2, longitude: 102, state: "Melaka", isActive: false }],
    ["outside Melaka", { _id: ATTRACTION_ID, latitude: 2, longitude: 102, state: "Johor", isActive: true }],
  ];

  for (const [label, attraction] of rejectedAttractions) {
    await t.test(label, async () => {
      const { service, calls } = createHarness({
        findAttractionByIdForVerifiedVisit: async () => attraction,
      });

      await expectServiceError(
        () => service.verifyVisitPhoto(validVerifyInput()),
        { statusCode: 404, message: "Attraction not found." }
      );
      assert.equal(calls.uploads.length, 0);
    });
  }
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

test("verify rejects distance above the canonical attraction radius before upload", async () => {
  const { service, calls } = createHarness();

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({
      latitude: 2 + latitudeOffset(50.1),
      verificationRadiusMeters: 150,
    })),
    {
      statusCode: 400,
      message: "You must be within 50 metres of the attraction to verify this visit.",
    }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify rejects accuracy above 30 before upload with measured guidance", async () => {
  const { service, calls } = createHarness();

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput({ accuracyMeters: 30.1 })),
    {
      statusCode: 400,
      message: "Location accuracy is currently 30.1 metres. Move outdoors and try again. Accuracy must be within 30 metres.",
    }
  );
  assert.equal(calls.uploads.length, 0);
});

test("verify accepts canonical distance and accuracy boundaries independently", async (t) => {
  for (const boundary of [
    { distanceMetres: 49.9, accuracyMeters: 29.9 },
    { distanceMetres: 50, accuracyMeters: 30 },
  ]) {
    await t.test(JSON.stringify(boundary), async () => {
      const { service, calls } = createHarness();

      await service.verifyVisitPhoto(validVerifyInput({
        latitude: 2 + latitudeOffset(boundary.distanceMetres),
        accuracyMeters: boundary.accuracyMeters,
      }));

      assert.equal(calls.uploads.length, 1);
      assert.ok(calls.appends[0].photos[0].distanceMeters <= 50.01);
      assert.equal(
        calls.appends[0].photos[0].accuracyMeters,
        boundary.accuracyMeters
      );
    });
  }
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
    findAttractionByIdForVerifiedVisit: async () => ({
      _id: ATTRACTION_ID,
      latitude: 0,
      longitude: 0,
      state: "Melaka",
      isActive: true,
      category: "Gallery",
    }),
  });

  await service.verifyVisitPhoto(validVerifyInput({
    latitude: "0",
    longitude: 0,
    accuracyMeters: "0",
  }));

  assert.deepEqual(
    {
      latitude: calls.appends[0].photos[0].latitude,
      longitude: calls.appends[0].photos[0].longitude,
      accuracyMeters: calls.appends[0].photos[0].accuracyMeters,
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
    photos: [{
      photoUrl: PHOTO_URL,
      cloudinaryPublicId: CLOUDINARY_PUBLIC_ID,
      capturedAt: NOW,
      latitude: 2,
      longitude: 102,
      accuracyMeters: 20,
      distanceMeters: 0,
    }],
  }]);
  assert.ok(!JSON.stringify(result).includes("cloudinaryPublicId"));
  assert.ok(!JSON.stringify(result).includes("latitude"));
});

test("verify uploads and atomically persists exactly one photo with a safe additive response", async () => {
  const { service, calls } = createHarness();

  const result = await service.verifyVisitPhotos(validBatchInput(1));

  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.appends.length, 1);
  assert.equal(calls.appends[0].photos.length, 1);
  assert.equal(result.photos.length, 1);
  assert.equal(result.photoId, result.photos[0].photoId);
  assert.equal(result.photoUrl, result.photos[0].photoUrl);
  for (const privateField of [
    "userId",
    "cloudinaryPublicId",
    "latitude",
    "longitude",
    "accuracyMeters",
    "distanceMeters",
  ]) {
    assert.equal(JSON.stringify(result).includes(privateField), false);
  }
});

test("single-photo verify compatibility wrapper preserves the original exact response shape", async () => {
  const { service } = createHarness();

  const result = await service.verifyVisitPhoto(validVerifyInput());

  assert.deepEqual(Object.keys(result).sort(), [
    "attractionId",
    "capturedDate",
    "photoId",
    "photoUrl",
    "verified",
    "visitId",
  ]);
  assert.equal(Object.hasOwn(result, "photos"), false);
});

test("verify requires exactly one valid image before lookup or upload", async (t) => {
  const invalidBatches = [
    [],
    [JPEG_DATA_URI, JPEG_DATA_URI],
    ["data:image/gif;base64,R0lGODlh"],
  ];

  for (const photoDataUris of invalidBatches) {
    await t.test(`${photoDataUris.length} submitted item(s)`, async () => {
      let userLookups = 0;
      const { service, calls } = createHarness({
        findUserByGoogleId: async () => {
          userLookups += 1;
          return { _id: USER_ID };
        },
      });

      await expectServiceError(
        () => service.verifyVisitPhotos(validBatchInput(1, { photoDataUris })),
        {
          statusCode: 400,
          message: photoDataUris.length === 1
            ? "A JPEG, PNG, or WebP image up to 5 MiB is required."
            : BATCH_SIZE_MESSAGE,
        }
      );
      assert.equal(userLookups, 0);
      assert.equal(calls.uploads.length, 0);
    });
  }
});

test("batch verify rejects an unsafe optional submission key before lookup or upload", async () => {
  let userLookups = 0;
  const { service, calls } = createHarness({
    findUserByGoogleId: async () => {
      userLookups += 1;
      return { _id: USER_ID };
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1, {
      submissionKey: "unsafe key",
    })),
    { statusCode: 400, message: "A valid submission key is required." }
  );
  assert.equal(userLookups, 0);
  assert.equal(calls.uploads.length, 0);
});

test("lost-response retry replays the original keyed result before capacity or upload", async () => {
  let persistedVisit = null;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      persistedVisit = {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        photos: input.photos.map((savedPhoto, index) => ({
          _id: index === 0 ? PHOTO_ID : `photo-${index + 1}`,
          photoUrl: savedPhoto.photoUrl,
          capturedAt: savedPhoto.capturedAt,
          submissionKey: input.submissionKey,
        })),
      };
      return persistedVisit;
    },
  });
  const input = validBatchInput(1, { submissionKey: SUBMISSION_KEY });

  const firstResult = await service.verifyVisitPhotos(input);
  const retryResult = await service.verifyVisitPhotos(input);

  assert.deepEqual(retryResult, firstResult);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.appends.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.appends[0].submissionKey, SUBMISSION_KEY);
  assert.equal(calls.submissionLookups.length, 2);
  assert.equal(JSON.stringify(retryResult).includes("submissionKey"), false);
});

test("lost-response retry after Malaysia midnight replays the original key without a second upload", async () => {
  const requestTimes = [
    new Date("2026-08-15T15:59:59.000Z"),
    new Date("2026-08-15T16:00:01.000Z"),
  ];
  let timeIndex = 0;
  let persistedVisit = null;
  const { service, calls } = createHarness({
    now: () => new Date(requestTimes[Math.min(timeIndex++, requestTimes.length - 1)]),
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      if (Object.hasOwn(input, "visitDateKey")) return null;
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      persistedVisit = {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        visitDateKey: input.visitDateKey,
        photos: [{
          _id: PHOTO_ID,
          photoUrl: input.photos[0].photoUrl,
          capturedAt: input.photos[0].capturedAt,
          submissionKey: input.submissionKey,
        }],
      };
      return persistedVisit;
    },
  });
  const input = validBatchInput(1, { submissionKey: SUBMISSION_KEY });

  const firstResult = await service.verifyVisitPhotos(input);
  const retryResult = await service.verifyVisitPhotos(input);

  assert.deepEqual(retryResult, firstResult);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.appends.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.equal(
    calls.submissionLookups.every((lookup) => !Object.hasOwn(lookup, "visitDateKey")),
    true
  );
  assert.equal(JSON.stringify(retryResult).includes("submissionKey"), false);
});

test("concurrent same-key submissions across Malaysia dates have one atomic winner", async () => {
  const requestTimes = [
    new Date("2026-08-15T15:59:59.000Z"),
    new Date("2026-08-15T16:00:01.000Z"),
  ];
  let timeIndex = 0;
  let persistedVisit = null;
  let initialLookupArrivals = 0;
  let releaseInitialLookups;
  const initialLookupBarrier = new Promise((resolve) => {
    releaseInitialLookups = resolve;
  });
  let appendArrivals = 0;
  let releaseAppends;
  const appendBarrier = new Promise((resolve) => {
    releaseAppends = resolve;
  });
  const { service, calls } = createHarness({
    now: () => new Date(requestTimes[Math.min(timeIndex++, requestTimes.length - 1)]),
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      if (!persistedVisit && initialLookupArrivals < 2) {
        initialLookupArrivals += 1;
        if (initialLookupArrivals === 2) releaseInitialLookups();
        await initialLookupBarrier;
        return null;
      }
      if (
        Object.hasOwn(input, "visitDateKey")
        && input.visitDateKey !== persistedVisit?.visitDateKey
      ) {
        return null;
      }
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      if (!persistedVisit && appendArrivals < 2) {
        appendArrivals += 1;
        if (appendArrivals === 2) releaseAppends();
        await appendBarrier;
      }

      if (persistedVisit) {
        throw Object.assign(new Error("duplicate private submission key"), {
          code: 11000,
        });
      }
      persistedVisit = {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        visitDateKey: input.visitDateKey,
        photos: [{
          _id: PHOTO_ID,
          photoUrl: input.photos[0].photoUrl,
          cloudinaryPublicId: input.photos[0].cloudinaryPublicId,
          capturedAt: input.photos[0].capturedAt,
          submissionKey: input.submissionKey,
        }],
      };
      return persistedVisit;
    },
  });
  const input = validBatchInput(1, { submissionKey: SUBMISSION_KEY });

  const results = await Promise.all([
    service.verifyVisitPhotos(input),
    service.verifyVisitPhotos(input),
  ]);

  assert.deepEqual(results[1], results[0]);
  assert.equal(calls.uploads.length, 2);
  assert.equal(new Set(calls.appends.slice(0, 2).map(({ visitDateKey }) => visitDateKey)).size, 2);
  assert.equal(calls.deletes.length, 1);
  assert.notEqual(calls.deletes[0], persistedVisit.photos[0].cloudinaryPublicId);
  assert.equal(
    calls.submissionLookups.every((lookup) => !Object.hasOwn(lookup, "visitDateKey")),
    true
  );
  assert.equal(JSON.stringify(results).includes("submissionKey"), false);
});

test("concurrent same-key loser cleans only its request asset and replays the winner", async () => {
  let persistedVisit = null;
  let appendArrivals = 0;
  let releaseAppends;
  const appendBarrier = new Promise((resolve) => {
    releaseAppends = resolve;
  });
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendArrivals += 1;
      if (appendArrivals === 2) releaseAppends();
      await appendBarrier;

      if (persistedVisit) return null;
      persistedVisit = {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        photos: [{
          _id: PHOTO_ID,
          photoUrl: input.photos[0].photoUrl,
          cloudinaryPublicId: input.photos[0].cloudinaryPublicId,
          capturedAt: input.photos[0].capturedAt,
          submissionKey: input.submissionKey,
        }],
      };
      return persistedVisit;
    },
  });
  const input = validBatchInput(1, { submissionKey: SUBMISSION_KEY });

  const [firstResult, secondResult] = await Promise.all([
    service.verifyVisitPhotos(input),
    service.verifyVisitPhotos(input),
  ]);

  assert.deepEqual(secondResult, firstResult);
  assert.equal(calls.uploads.length, 2);
  assert.equal(calls.appends.length, 2);
  assert.equal(calls.deletes.length, 1);
  assert.notEqual(
    calls.deletes[0],
    persistedVisit.photos[0].cloudinaryPublicId,
    "the winning request asset must not be deleted"
  );
  assert.equal(JSON.stringify(firstResult).includes("submissionKey"), false);
});

test("keyed append that commits before losing its acknowledgement replays its exact photo without cleanup", async () => {
  let persistedVisit = null;
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        persistedVisit = {
          _id: VISIT_ID,
          attractionId: ATTRACTION_ID,
          photos: input.photos.map((savedPhoto) => ({
            _id: PHOTO_ID,
            photoUrl: savedPhoto.photoUrl,
            capturedAt: savedPhoto.capturedAt,
            submissionKey: input.submissionKey,
          })),
        };
        throw new Error("write committed but acknowledgement was lost");
      }
      throw new Error("retry outcome was also not acknowledged");
    },
  });

  const result = await service.verifyVisitPhotos(validBatchInput(1, {
    submissionKey: SUBMISSION_KEY,
  }));

  assert.deepEqual(result, {
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
    attractionId: ATTRACTION_ID,
    photoUrl: "https://res.cloudinary.com/demo/image/upload/11111111-1111-4111-8111-111111111111.jpg",
    capturedDate: NOW.toISOString(),
    verified: true,
    photos: [
      {
        photoId: PHOTO_ID,
        photoUrl: "https://res.cloudinary.com/demo/image/upload/11111111-1111-4111-8111-111111111111.jpg",
        capturedDate: NOW.toISOString(),
        verified: true,
      },
    ],
  });
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.deepEqual(calls.deletes, []);
  assert.equal(JSON.stringify(result).includes("submissionKey"), false);
});

test("keyed append retries the identical batch once without reuploading and returns the retry success", async () => {
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        throw new Error("first acknowledgement was lost before commit");
      }
      return {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        photos: [{
          _id: PHOTO_ID,
          photoUrl: input.photos[0].photoUrl,
          capturedAt: input.photos[0].capturedAt,
          submissionKey: input.submissionKey,
        }],
      };
    },
  });

  const result = await service.verifyVisitPhotos(validBatchInput(1, {
    submissionKey: SUBMISSION_KEY,
  }));

  assert.equal(
    result.photoUrl,
    "https://res.cloudinary.com/demo/image/upload/11111111-1111-4111-8111-111111111111.jpg"
  );
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 1);
  assert.deepEqual(calls.deletes, []);
  assert.equal(JSON.stringify(result).includes("submissionKey"), false);
});

test("keyed retry waits out delayed first-write visibility before deciding cleanup", async () => {
  let persistedVisit = null;
  let pendingFirstAppend = null;
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return persistedVisit;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        pendingFirstAppend = input;
        throw new Error("first write remains in flight");
      }

      persistedVisit = {
        _id: VISIT_ID,
        attractionId: ATTRACTION_ID,
        photos: pendingFirstAppend.photos.map((savedPhoto) => ({
          _id: PHOTO_ID,
          photoUrl: savedPhoto.photoUrl,
          capturedAt: savedPhoto.capturedAt,
          submissionKey: pendingFirstAppend.submissionKey,
        })),
      };
      return null;
    },
  });

  const result = await service.verifyVisitPhotos(validBatchInput(1, {
    submissionKey: SUBMISSION_KEY,
  }));

  assert.equal(
    result.photoUrl,
    "https://res.cloudinary.com/demo/image/upload/11111111-1111-4111-8111-111111111111.jpg"
  );
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.deepEqual(calls.deletes, []);
});

test("keyed append failure cleans its distinct assets when reconciliation finds a concurrent winner", async () => {
  const winnerVisit = {
    _id: VISIT_ID,
    attractionId: ATTRACTION_ID,
    photos: [{
      _id: PHOTO_ID,
      photoUrl: "https://res.cloudinary.com/demo/image/upload/concurrent-winner.jpg",
      capturedAt: NOW,
      submissionKey: SUBMISSION_KEY,
    }],
  };
  let winnerVisible = false;
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return winnerVisible ? winnerVisit : null;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        winnerVisible = true;
        throw new Error("concurrent write outcome was not acknowledged");
      }
      return null;
    },
  });

  const result = await service.verifyVisitPhotos(validBatchInput(1, {
    submissionKey: SUBMISSION_KEY,
  }));

  assert.equal(result.photoUrl, winnerVisit.photos[0].photoUrl);
  assert.deepEqual(calls.deletes, [
    "chatlas/verified-visits/11111111-1111-4111-8111-111111111111",
  ]);
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.equal(JSON.stringify(result).includes("submissionKey"), false);
});

test("completed keyed retry preserves uploaded assets when reconciliation is unavailable", async () => {
  let lookupCount = 0;
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      lookupCount += 1;
      if (lookupCount === 1) return null;
      throw new Error("reconciliation lookup unavailable");
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        throw new Error("write outcome unknown");
      }
      return null;
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1, {
      submissionKey: SUBMISSION_KEY,
    })),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.deepEqual(calls.deletes, []);
});

test("second keyed append uncertainty preserves uploaded assets when reconciliation is still empty", async () => {
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return null;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      throw new Error("append outcome remains unknown");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1, {
      submissionKey: SUBMISSION_KEY,
    })),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.deepEqual(calls.deletes, []);
});

test("keyed append failure cleans uploaded assets after reconciliation confirms no commit", async () => {
  let appendAttempt = 0;
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, { publicId }) => {
      calls.uploads.push({ dataUri, options: { publicId } });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/${publicId}`,
      };
    },
    findDatedVisitBySubmissionKey: async (input) => {
      calls.submissionLookups.push(input);
      return null;
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      appendAttempt += 1;
      if (appendAttempt === 1) {
        throw new Error("write did not commit");
      }
      return null;
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1, {
      submissionKey: SUBMISSION_KEY,
    })),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.equal(calls.appends.length, 2);
  assert.deepEqual(calls.appends[1], calls.appends[0]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.photoCounts.length, 1);
  assert.equal(calls.submissionLookups.length, 2);
  assert.deepEqual(calls.deletes, [
    "chatlas/verified-visits/11111111-1111-4111-8111-111111111111",
  ]);
});

test("verify rejects an existing dated photo before uploading another", async () => {
  const { service, calls } = createHarness({
    findDatedVisitPhotoCount: async (input) => {
      calls.photoCounts.push(input);
      return 1;
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1)),
    { statusCode: 409, message: CAPACITY_MESSAGE }
  );
  assert.equal(calls.uploads.length, 0);
  assert.equal(calls.appends.length, 0);
});

test("verify cleans a malformed singleton upload response", async () => {
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, options) => {
      const index = calls.uploads.length + 1;
      calls.uploads.push({ dataUri, options });
      return { cloudinaryPublicId: "chatlas/verified-visits/private-1" };
    },
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
      if (publicId.endsWith("private-1")) throw new Error("cleanup unavailable");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1)),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.deepEqual(calls.deletes, [
    "chatlas/verified-visits/private-1",
  ]);
  assert.equal(calls.uploads.length, 1);
  assert.equal(calls.appends.length, 0);
});

test("verify cleans its uploaded asset when the one atomic Mongo write fails", async () => {
  const { service, calls } = createHarness({
    uploadVerifiedVisitImage: async (dataUri, options) => {
      const index = calls.uploads.length + 1;
      calls.uploads.push({ dataUri, options });
      return {
        photoUrl: `https://res.cloudinary.com/demo/image/upload/verified-${index}.jpg`,
        cloudinaryPublicId: `chatlas/verified-visits/private-${index}`,
      };
    },
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      throw new Error("private database details");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhotos(validBatchInput(1)),
    { statusCode: 500, message: "Unable to save the verified visit photo." }
  );
  assert.deepEqual(calls.deletes, [
    "chatlas/verified-visits/private-1",
  ]);
  assert.equal(calls.appends.length, 1);
  assert.equal(calls.photoCounts.length, 1);
});

test("capacity reports the actual legacy count while clamping remaining slots to zero or one", async (t) => {
  for (const [existingTodayCount, remainingSlots] of [[0, 1], [1, 0], [2, 0], [3, 0]]) {
    await t.test(`${existingTodayCount} existing`, async () => {
      const { service } = createHarness({
        findDatedVisitPhotoCount: async () => existingTodayCount,
      });

      assert.deepEqual(await service.getVerifiedVisitPhotoCapacity({
        googleId: GOOGLE_ID,
        attractionId: ATTRACTION_ID,
      }), {
        attractionId: ATTRACTION_ID,
        dailyLimit: 1,
        existingTodayCount,
        remainingSlots,
      });
    });
  }
});

test("deletion restores capacity only when no dated photo remains", async (t) => {
  for (const [label, initialCount, expectedCount, expectedRemainingSlots] of [
    ["final photo", 1, 0, 1],
    ["one photo from a legacy pair", 2, 1, 0],
  ]) {
    await t.test(label, async () => {
      let remainingCount = initialCount;
      const { service } = createHarness({
        findDatedVisitPhotoCount: async () => remainingCount,
        removeOwnedPhoto: async () => {
          remainingCount -= 1;
          return {
            _id: VISIT_ID,
            photos: Array.from({ length: remainingCount }, (_, index) => ({
              _id: `remaining-photo-${index + 1}`,
            })),
          };
        },
      });

      await service.deleteOwnedVerifiedPhoto({
        googleId: GOOGLE_ID,
        visitId: VISIT_ID,
        photoId: PHOTO_ID,
      });

      assert.deepEqual(await service.getVerifiedVisitPhotoCapacity({
        googleId: GOOGLE_ID,
        attractionId: ATTRACTION_ID,
      }), {
        attractionId: ATTRACTION_ID,
        dailyLimit: 1,
        existingTodayCount: expectedCount,
        remainingSlots: expectedRemainingSlots,
      });
    });
  }
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
    appendPhotosToDatedVisit: async (input) => {
      calls.appends.push(input);
      return {
        _id: VISIT_ID,
        photos: [{ _id: PHOTO_ID, photoUrl: input.photos[0].photoUrl, capturedAt: NOW }],
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
    appendPhotosToDatedVisit: async () => {
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
    appendPhotosToDatedVisit: async () => null,
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
      assert.notEqual(publicId, oldAsset);
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    {
      statusCode: 409,
      message: CAPACITY_MESSAGE,
    }
  );
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
});

test("verify keeps the capacity response and does not retry cleanup when cleanup fails", async () => {
  let cleanupAttempts = 0;
  const { service } = createHarness({
    appendPhotosToDatedVisit: async () => null,
    deleteCloudinaryImage: async () => {
      cleanupAttempts += 1;
      throw new Error("Cloudinary unavailable");
    },
  });

  await expectServiceError(
    () => service.verifyVisitPhoto(validVerifyInput()),
    { statusCode: 409, message: CAPACITY_MESSAGE }
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

test("owner deletion removes database evidence before external asset cleanup", async () => {
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
  assert.deepEqual(order, ["ownership", "repository", "cloudinary", "empty-group"]);
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

test("Cloudinary deletion failure cannot leave broken database evidence", async () => {
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

  const result = await service.deleteOwnedVerifiedPhoto({
    googleId: GOOGLE_ID,
    visitId: VISIT_ID,
    photoId: PHOTO_ID,
  });

  assert.equal(result, undefined);
  assert.equal(evidencePresent, false);
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.equal(calls.removals.length, 1);
  assert.deepEqual(calls.emptyDeletes, [VISIT_ID]);
});

test("owner deletion safely handles ownership lookup and database pull failures", async (t) => {
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

  await t.test("atomic pull failure leaves the external asset untouched", async () => {
    const { service, calls } = createHarness({
      removeOwnedPhoto: async () => {
        throw new Error("database private failure");
      },
    });
    await expectServiceError(
      () => service.deleteOwnedVerifiedPhoto({ googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID }),
      { statusCode: 500, message: "Unable to delete the verified visit photo." }
    );
    assert.deepEqual(calls.deletes, []);
    assert.deepEqual(calls.emptyDeletes, []);
  });
});

test("owner retry completes metadata and empty-group cleanup after a transient Mongo pull failure", async () => {
  let removeAttempts = 0;
  let evidencePresent = true;
  const { service, calls } = createHarness({
    findOwnedPhotoForDeletion: async (input) => {
      calls.ownershipLookups.push(input);
      return evidencePresent ? { cloudinaryPublicId: CLOUDINARY_PUBLIC_ID } : null;
    },
    deleteCloudinaryImage: async (publicId) => {
      calls.deletes.push(publicId);
    },
    removeOwnedPhoto: async (input) => {
      calls.removals.push(input);
      removeAttempts += 1;
      if (removeAttempts === 1) {
        throw new Error("transient Mongo failure");
      }
      evidencePresent = false;
      return { _id: VISIT_ID, photos: [] };
    },
  });
  const input = { googleId: GOOGLE_ID, visitId: VISIT_ID, photoId: PHOTO_ID };

  await expectServiceError(
    () => service.deleteOwnedVerifiedPhoto(input),
    { statusCode: 500, message: "Unable to delete the verified visit photo." }
  );
  await service.deleteOwnedVerifiedPhoto(input);

  assert.equal(evidencePresent, false);
  assert.deepEqual(calls.deletes, [CLOUDINARY_PUBLIC_ID]);
  assert.equal(calls.removals.length, 2);
  assert.deepEqual(calls.emptyDeletes, [VISIT_ID]);
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
