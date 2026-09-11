import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createImageModerationService,
  IMAGE_MODERATION_CODES,
  ImageModerationError,
} from "../src/business/services/imageModerationService.js";
import {
  createReviewPhotoUpdatePersistence,
  createReviewSubmissionService,
  ReviewServiceError,
} from "../src/business/services/reviewService.js";
import {
  createVerifiedVisitService,
  VerifiedVisitServiceError,
} from "../src/business/services/verifiedVisitService.js";
import { createProfileImageService } from "../src/business/services/profileImageService.js";
import { createRekognitionAdapter } from "../src/infrastructure/external/rekognition.js";

const USER_ID = "64b000000000000000000001";
const ATTRACTION_ID = "64b000000000000000000002";
const JPEG_DATA_URI = "data:image/jpeg;base64,/9j/2Q==";

function imageError(code) {
  return new ImageModerationError(code);
}

function createReviewHarness(moderateFiles) {
  const calls = { uploads: 0, creates: 0 };
  const submitReview = createReviewSubmissionService({
    findAttraction: async () => ({ _id: ATTRACTION_ID }),
    findUser: async () => ({
      _id: USER_ID,
      name: "Aina",
      displayName: "Aina",
      profilePicture: "",
    }),
    moderateFiles,
    uploadImage: async () => {
      calls.uploads += 1;
      return { url: "https://example.test/review.jpg", publicId: "review-1" };
    },
    createReviewRecord: async (input) => {
      calls.creates += 1;
      return { _id: "review-1", ...input, likes: [] };
    },
    deleteImage: async () => {},
    createUuid: () => "uuid",
  });

  return { calls, submitReview };
}

function reviewInput(photoFiles = [{ name: "one.jpg" }]) {
  return {
    attractionId: ATTRACTION_ID,
    email: "aina@example.test",
    rating: 5,
    reviewText: "A family day out.",
    photoFiles: photoFiles.map((file) => ({
      type: "image/jpeg",
      size: 4,
      arrayBuffer: async () => Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      ...file,
    })),
  };
}

test("an unsafe Review photo prevents Cloudinary upload and Review creation", async () => {
  const { calls, submitReview } = createReviewHarness(async () => {
    throw imageError(IMAGE_MODERATION_CODES.unsafe);
  });

  await assert.rejects(submitReview(reviewInput()), (error) =>
    error instanceof ReviewServiceError &&
    error.code === IMAGE_MODERATION_CODES.unsafe &&
    error.statusCode === 422
  );
  assert.deepEqual(calls, { uploads: 0, creates: 0 });
});

test("multiple Review photos are atomic when any photo fails moderation", async () => {
  const { calls, submitReview } = createReviewHarness(async (files) => {
    assert.equal(files.length, 2);
    throw imageError(IMAGE_MODERATION_CODES.unsafe);
  });

  await assert.rejects(
    submitReview(reviewInput([{ name: "safe.jpg" }, { name: "unsafe.jpg" }])),
    { code: IMAGE_MODERATION_CODES.unsafe }
  );
  assert.deepEqual(calls, { uploads: 0, creates: 0 });
});

test("Review photo updates clean partial uploads without changing MongoDB", async () => {
  const calls = { uploads: [], updates: 0, deletes: [] };
  const persistUpdate = createReviewPhotoUpdatePersistence({
    uploadImage: async () => {
      const uploadNumber = calls.uploads.length + 1;
      calls.uploads.push(uploadNumber);
      if (uploadNumber === 2) throw new Error("second upload failed");
      return {
        url: `https://example.test/review-${uploadNumber}.jpg`,
        publicId: `review-${uploadNumber}`,
      };
    },
    updateReviewRecord: async () => {
      calls.updates += 1;
    },
    deleteImage: async (publicId) => calls.deletes.push(publicId),
    createUuid: () => "uuid",
  });

  await assert.rejects(
    persistUpdate({
      reviewId: "review-id",
      attractionId: ATTRACTION_ID,
      retainedPhotos: [],
      approvedPhotos: [
        { buffer: Buffer.from("one"), mimeType: "image/jpeg" },
        { buffer: Buffer.from("two"), mimeType: "image/jpeg" },
      ],
      rating: 5,
      reviewText: "Still a family day out.",
      lastEditedAt: new Date("2026-09-11T01:00:00.000Z"),
    }),
    /second upload failed/
  );

  assert.deepEqual(calls, {
    uploads: [1, 2],
    updates: 0,
    deletes: ["review-1"],
  });
});

test("Review photo updates retain new assets after the atomic MongoDB write", async () => {
  const calls = { updates: 0, deletes: [] };
  const updatedReview = { _id: "review-id", photos: [] };
  const persistUpdate = createReviewPhotoUpdatePersistence({
    uploadImage: async () => ({
      url: "https://example.test/new.jpg",
      publicId: "review-new",
    }),
    updateReviewRecord: async () => {
      calls.updates += 1;
      return updatedReview;
    },
    deleteImage: async (publicId) => calls.deletes.push(publicId),
    createUuid: () => "uuid",
  });

  const result = await persistUpdate({
    reviewId: "review-id",
    attractionId: ATTRACTION_ID,
    retainedPhotos: [],
    approvedPhotos: [
      { buffer: Buffer.from("one"), mimeType: "image/jpeg" },
    ],
    rating: 5,
    reviewText: "Updated review.",
    lastEditedAt: new Date("2026-09-11T01:00:00.000Z"),
  });

  assert.equal(result, updatedReview);
  assert.deepEqual(calls, { updates: 1, deletes: [] });
});

test("Review photo updates remove every new asset when MongoDB rejects the write", async () => {
  const calls = { uploadNumber: 0, deletes: [] };
  const persistUpdate = createReviewPhotoUpdatePersistence({
    uploadImage: async () => {
      calls.uploadNumber += 1;
      return {
        url: `https://example.test/new-${calls.uploadNumber}.jpg`,
        publicId: `review-new-${calls.uploadNumber}`,
      };
    },
    updateReviewRecord: async () => {
      throw new Error("database write failed");
    },
    deleteImage: async (publicId) => calls.deletes.push(publicId),
    createUuid: () => "uuid",
  });

  await assert.rejects(
    persistUpdate({
      reviewId: "review-id",
      attractionId: ATTRACTION_ID,
      retainedPhotos: [],
      approvedPhotos: [
        { buffer: Buffer.from("one"), mimeType: "image/jpeg" },
        { buffer: Buffer.from("two"), mimeType: "image/jpeg" },
      ],
      rating: 5,
      reviewText: "Updated review.",
      lastEditedAt: new Date("2026-09-11T01:00:00.000Z"),
    }),
    /database write failed/
  );

  assert.deepEqual(calls, {
    uploadNumber: 2,
    deletes: ["review-new-1", "review-new-2"],
  });
});

test("AWS unavailable returns 503 and neither Cloudinary nor persistence is called", async () => {
  const { calls, submitReview } = createReviewHarness(async () => {
    throw imageError(IMAGE_MODERATION_CODES.unavailable);
  });

  await assert.rejects(submitReview(reviewInput()), {
    code: IMAGE_MODERATION_CODES.unavailable,
    statusCode: 503,
  });
  assert.deepEqual(calls, { uploads: 0, creates: 0 });
});

test("missing AWS configuration returns 503 before upload or persistence", async () => {
  const variableNames = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ];
  const previousValues = new Map(
    variableNames.map((name) => [
      name,
      {
        existed: Object.hasOwn(process.env, name),
        value: process.env[name],
      },
    ])
  );

  for (const name of variableNames) delete process.env[name];

  try {
    const adapter = createRekognitionAdapter();
    const moderationService = createImageModerationService({
      detectLabels: (bytes, options) =>
        adapter.detectModerationLabels(bytes, options),
      getConfiguration: () => ({
        minConfidence: 50,
        rejectConfidence: 70,
      }),
    });
    const { calls, submitReview } = createReviewHarness((files) =>
      moderationService.moderateUploadedFiles(files)
    );

    await assert.rejects(submitReview(reviewInput()), {
      code: IMAGE_MODERATION_CODES.unavailable,
      statusCode: 503,
    });
    assert.deepEqual(calls, { uploads: 0, creates: 0 });
  } finally {
    for (const [name, previous] of previousValues) {
      if (previous.existed) process.env[name] = previous.value;
      else delete process.env[name];
    }
  }
});

function createVisitHarness() {
  const calls = { uploads: 0, appends: 0 };
  const service = createVerifiedVisitService({
    isValidObjectId: () => true,
    now: () => new Date("2026-09-11T01:00:00.000Z"),
    randomUUID: () => "uuid",
    findUserByGoogleId: async () => ({ _id: USER_ID }),
    findAttractionByIdForVerifiedVisit: async () => ({
      _id: ATTRACTION_ID,
      latitude: 2,
      longitude: 102,
      state: "Melaka",
      isActive: true,
    }),
    moderateImageDataUri: async () => {
      throw imageError(IMAGE_MODERATION_CODES.unsafe);
    },
    uploadVerifiedVisitImage: async () => {
      calls.uploads += 1;
    },
    deleteCloudinaryImage: async () => {},
    appendPhotosToDatedVisit: async () => {
      calls.appends += 1;
    },
    findDatedVisitBySubmissionKey: async () => null,
    findDatedVisitPhotoCount: async () => 0,
    findDistinctVerifiedAttractionIds: async () => [],
    findVerifiedAttractionsWithLatestVisitDate: async () => [],
    findPublicVerifiedPhotos: async () => [],
    findOwnedPhotoForDeletion: async () => null,
    removeOwnedPhoto: async () => null,
    deleteVisitWhenEmpty: async () => {},
  });

  return { calls, service };
}

test("an unsafe Nearby Visit photo cannot upload evidence or create a visit", async () => {
  const { calls, service } = createVisitHarness();

  await assert.rejects(
    service.verifyVisitPhoto({
      googleId: "google-subject",
      attractionId: ATTRACTION_ID,
      latitude: 2,
      longitude: 102,
      accuracyMeters: 10,
      photoDataUri: JPEG_DATA_URI,
    }),
    (error) =>
      error instanceof VerifiedVisitServiceError &&
      error.code === IMAGE_MODERATION_CODES.unsafe &&
      error.statusCode === 422
  );
  assert.deepEqual(calls, { uploads: 0, appends: 0 });
});

test("an unsafe avatar retains the existing avatar", async () => {
  const calls = { uploads: 0, updates: 0 };
  const service = createProfileImageService({
    findUser: async () => ({
      _id: USER_ID,
      profilePicture: "https://example.test/current.jpg",
      profilePicturePublicId: "profiles/current",
    }),
    updateProfileImage: async () => {
      calls.updates += 1;
    },
    moderateFile: async () => {
      throw imageError(IMAGE_MODERATION_CODES.unsafe);
    },
    uploadImage: async () => {
      calls.uploads += 1;
    },
    deleteImage: async () => {},
    createUuid: () => "uuid",
  });

  await assert.rejects(
    service.replaceProfileImage({}, { googleId: "google-subject" }),
    { code: IMAGE_MODERATION_CODES.unsafe, statusCode: 422 }
  );
  assert.deepEqual(calls, { uploads: 0, updates: 0 });
});

test("an owned approved Review photo can remain the profile picture source", async () => {
  const calls = { lookup: null, update: null, deletes: [] };
  const service = createProfileImageService({
    findUser: async () => ({
      _id: USER_ID,
      profilePicture: "https://example.test/current-avatar.jpg",
      profilePicturePublicId: "profile-current",
    }),
    findOwnedReviewPhoto: async (input) => {
      calls.lookup = input;
      return {
        url: "https://example.test/approved-review.jpg",
        publicId: "review-owned",
      };
    },
    updateProfileImage: async (userId, image) => {
      calls.update = { userId, image };
      return { _id: userId, profilePicture: image.url };
    },
    moderateFile: async () => assert.fail("approved data is not re-moderated"),
    uploadImage: async () => assert.fail("existing data is not uploaded again"),
    deleteImage: async (publicId) => calls.deletes.push(publicId),
    createUuid: () => "uuid",
  });

  const result = await service.useOwnedReviewPhotoAsProfileImage(
    "review-owned",
    { googleId: "google-subject" }
  );

  assert.deepEqual(result, {
    url: "https://example.test/approved-review.jpg",
    publicId: "review-owned",
  });
  assert.deepEqual(calls, {
    lookup: { userId: USER_ID, publicId: "review-owned" },
    update: {
      userId: USER_ID,
      image: {
        url: "https://example.test/approved-review.jpg",
        publicId: "",
      },
    },
    deletes: ["profile-current"],
  });
});

test("an arbitrary or another user's Review public ID cannot replace the avatar", async () => {
  let updates = 0;
  const service = createProfileImageService({
    findUser: async () => ({ _id: USER_ID }),
    findOwnedReviewPhoto: async () => null,
    updateProfileImage: async () => {
      updates += 1;
    },
    moderateFile: async () => {},
    uploadImage: async () => {},
    deleteImage: async () => {},
    createUuid: () => "uuid",
  });

  await assert.rejects(
    service.useOwnedReviewPhotoAsProfileImage("review-not-owned", {
      googleId: "google-subject",
    }),
    { name: "ProfileImageServiceError", statusCode: 404 }
  );
  assert.equal(updates, 0);
});

test("display-only Personal Collection and Social Profile code never re-moderates approved URLs", async () => {
  const displayOnlyFiles = [
    "src/business/services/myPhotosService.js",
    "src/business/services/socialProfileService.js",
    "src/presentation/components/PublicSocialProfile.js",
    "src/presentation/components/PublicProfile.js",
  ];

  for (const path of displayOnlyFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /imageModeration|rekognition/i, path);
  }
});

test("Auth.js never accepts a profile image URL from a client session update", async () => {
  const [authSource, profileRouteSource, photosPageSource] = await Promise.all([
    readFile(new URL("../src/auth.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/app/api/user/profile-picture/route.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../src/app/photos/page.js", import.meta.url),
      "utf8"
    ),
  ]);

  assert.doesNotMatch(authSource, /token\.picture\s*=\s*session\.user\.image/);
  assert.match(authSource, /token\.picture\s*=\s*dbUser\.profilePicture/);
  assert.match(profileRouteSource, /Object\.hasOwn\(body, "photoUrl"\)/);
  assert.doesNotMatch(photosPageSource, /photoUrl:\s*photo\.url/);
});

test("image moderation localization keys exist in every supported locale", async () => {
  const languageSource = await readFile(
    new URL(
      "../src/presentation/contexts/LanguageContext.js",
      import.meta.url
    ),
    "utf8"
  );
  const keys = [
    "imageSafetyChecking",
    "imageSafetyRejected",
    "imageSafetyUnavailable",
    "imageInvalid",
    "imageTooLarge",
  ];

  for (const key of keys) {
    assert.equal(
      languageSource.match(new RegExp(`\\b${key}\\s*:`, "g"))?.length,
      3,
      `${key} must exist in English, Chinese, and Malay`
    );
  }
});
