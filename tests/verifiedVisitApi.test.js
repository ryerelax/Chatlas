import assert from "node:assert/strict";
import test from "node:test";
import {
  createVerifiedVisitService,
  VerifiedVisitServiceError,
} from "../src/business/services/verifiedVisitService.js";
import {
  createVerifiedVisitsHandlers,
} from "../src/app/api/exploration-map/verified-visits/handler.js";
import {
  createDeleteVerifiedPhotoHandler,
} from "../src/app/api/exploration-map/verified-visits/[visitId]/photos/[photoId]/handler.js";
import {
  createPublicVerifiedPhotosHandler,
} from "../src/app/api/attractions/[id]/verified-photos/handler.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const AUTH_REQUIRED_MESSAGE = "A signed-in user account is required.";
const INVALID_IMAGE_MESSAGE = "A JPEG, PNG, or WebP image up to 5 MiB is required.";

function createPrivateHandlers(overrides = {}) {
  return createVerifiedVisitsHandlers({
    auth: async () => ({ user: { id: "google-subject-1" } }),
    connectToDatabase: async () => {},
    getVerifiedAttractionIdsForUser: async () => [],
    verifyVisitPhoto: async () => ({ photoId: "photo-1" }),
    ServiceError: VerifiedVisitServiceError,
    maxImageBytes: MAX_IMAGE_BYTES,
    ...overrides,
  });
}

function createDeleteHandler(overrides = {}) {
  return createDeleteVerifiedPhotoHandler({
    auth: async () => ({ user: { id: "google-subject-1" } }),
    connectToDatabase: async () => {},
    deleteOwnedVerifiedPhoto: async () => {},
    ServiceError: VerifiedVisitServiceError,
    ...overrides,
  });
}

function createPublicHandler(overrides = {}) {
  return createPublicVerifiedPhotosHandler({
    auth: async () => null,
    connectToDatabase: async () => {},
    getPublicVerifiedPhotos: async () => [],
    ServiceError: VerifiedVisitServiceError,
    ...overrides,
  });
}

function createFormRequest(entries = {}, formDataError) {
  return {
    async formData() {
      if (formDataError) throw formDataError;

      return {
        get(name) {
          return Object.hasOwn(entries, name) ? entries[name] : null;
        },
      };
    },
  };
}

function createPhotoFile({
  type = "image/png",
  size = 3,
  bytes = Uint8Array.from([1, 2, 3]),
  arrayBufferError,
  onArrayBuffer,
} = {}) {
  return {
    type,
    size,
    async arrayBuffer() {
      onArrayBuffer?.();
      if (arrayBufferError) throw arrayBufferError;
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

async function assertJsonResponse(response, status, body) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), body);
}

for (const [label, session] of [
  ["missing session", null],
  ["missing session user", {}],
  ["missing provider subject", { user: {} }],
  ["non-string provider subject", { user: { id: 123 } }],
  ["blank provider subject", { user: { id: "   " } }],
]) {
  test(`private GET rejects ${label}`, async () => {
    let connected = false;
    const { GET } = createPrivateHandlers({
      auth: async () => session,
      connectToDatabase: async () => {
        connected = true;
      },
    });

    const response = await GET();

    await assertJsonResponse(response, 401, {
      success: false,
      message: AUTH_REQUIRED_MESSAGE,
    });
    assert.equal(connected, false);
  });
}

test("private GET returns the distinct IDs from the service", async () => {
  const ids = ["attraction-1", "attraction-2"];
  const observed = [];
  const { GET } = createPrivateHandlers({
    connectToDatabase: async () => observed.push("connect"),
    getVerifiedAttractionIdsForUser: async (googleId) => {
      observed.push(["service", googleId]);
      return ids;
    },
  });

  const response = await GET();

  await assertJsonResponse(response, 200, { success: true, data: ids });
  assert.deepEqual(observed, ["connect", ["service", "google-subject-1"]]);
});

test("private GET returns a safe error when auth fails", async () => {
  const { GET } = createPrivateHandlers({
    auth: async () => {
      throw new Error("private auth cookie and token details");
    },
  });

  await assertJsonResponse(await GET(), 500, {
    success: false,
    message: "Unable to load verified visits.",
  });
});

test("private GET preserves an exact service error status and message", async () => {
  const { GET } = createPrivateHandlers({
    getVerifiedAttractionIdsForUser: async () => {
      throw new VerifiedVisitServiceError(AUTH_REQUIRED_MESSAGE, 401);
    },
  });

  await assertJsonResponse(await GET(), 401, {
    success: false,
    message: AUTH_REQUIRED_MESSAGE,
  });
});

for (const [label, failure] of [
  ["database", async () => { throw new Error("mongodb+srv://private-host"); }],
  ["service", async () => { throw new Error("private repository internals"); }],
]) {
  test(`private GET returns safe JSON for an unexpected ${label} failure`, async () => {
    const { GET } = createPrivateHandlers(label === "database"
      ? { connectToDatabase: failure }
      : { getVerifiedAttractionIdsForUser: failure });

    await assertJsonResponse(await GET(), 500, {
      success: false,
      message: "Unable to load verified visits.",
    });
  });
}

test("POST returns safe JSON when multipart parsing fails", async () => {
  const { POST } = createPrivateHandlers();
  const request = createFormRequest({}, new Error("multipart parser internals"));

  await assertJsonResponse(await POST(request), 400, {
    success: false,
    message: "Invalid verified visit request.",
  });
});

test("POST returns safe JSON when multipart data has no readable fields", async () => {
  const { POST } = createPrivateHandlers();
  const request = { formData: async () => null };

  await assertJsonResponse(await POST(request), 400, {
    success: false,
    message: "Invalid verified visit request.",
  });
});

test("POST returns safe JSON when reading a multipart field fails", async () => {
  const { POST } = createPrivateHandlers();
  const request = {
    formData: async () => ({
      get() {
        throw new Error("malformed multipart field internals");
      },
    }),
  };

  await assertJsonResponse(await POST(request), 400, {
    success: false,
    message: "Invalid verified visit request.",
  });
});

for (const [label, photo] of [
  ["missing photo", null],
  ["text in the photo field", "not-a-file"],
  ["a file-like value without a MIME type", { size: 1, arrayBuffer: async () => new ArrayBuffer(1) }],
]) {
  test(`POST rejects ${label}`, async () => {
    const { POST } = createPrivateHandlers();

    await assertJsonResponse(
      await POST(createFormRequest({ photo })),
      400,
      { success: false, message: INVALID_IMAGE_MESSAGE }
    );
  });
}

test("POST returns safe JSON when reading the photo bytes fails", async () => {
  const { POST } = createPrivateHandlers();
  const photo = createPhotoFile({
    arrayBufferError: new Error("temporary upload path details"),
  });

  await assertJsonResponse(
    await POST(createFormRequest({ photo })),
    400,
    { success: false, message: INVALID_IMAGE_MESSAGE }
  );
});

test("POST rejects an obviously oversized file before reading its bytes", async () => {
  let arrayBufferCalled = false;
  const { POST } = createPrivateHandlers();
  const photo = createPhotoFile({
    size: MAX_IMAGE_BYTES + 1,
    onArrayBuffer: () => {
      arrayBufferCalled = true;
    },
  });

  await assertJsonResponse(
    await POST(createFormRequest({ photo })),
    400,
    { success: false, message: INVALID_IMAGE_MESSAGE }
  );
  assert.equal(arrayBufferCalled, false);
});

test("POST ignores client identity and passes only the provider subject to the service", async () => {
  const created = {
    visitId: "visit-1",
    photoId: "photo-1",
    attractionId: "507f1f77bcf86cd799439011",
    photoUrl: "https://images.example/verified.jpg",
    capturedDate: "2026-08-16T08:00:00.000Z",
    verified: true,
  };
  let serviceInput;
  const { POST } = createPrivateHandlers({
    verifyVisitPhoto: async (input) => {
      serviceInput = input;
      return created;
    },
  });
  const request = createFormRequest({
    userId: "client-controlled-mongo-id",
    googleId: "client-controlled-provider-id",
    attractionId: "507f1f77bcf86cd799439011",
    latitude: "2.1944",
    longitude: "102.2491",
    accuracyMeters: "15",
    photo: createPhotoFile(),
  });

  const response = await POST(request);

  await assertJsonResponse(response, 201, { success: true, data: created });
  assert.deepEqual(serviceInput, {
    googleId: "google-subject-1",
    attractionId: "507f1f77bcf86cd799439011",
    latitude: "2.1944",
    longitude: "102.2491",
    accuracyMeters: "15",
    photoDataUri: "data:image/png;base64,AQID",
  });
  assert.equal(Object.hasOwn(serviceInput, "userId"), false);
});

test("POST rejects an invalid session shape before parsing multipart data", async () => {
  let parsed = false;
  const { POST } = createPrivateHandlers({ auth: async () => ({ user: {} }) });
  const request = {
    async formData() {
      parsed = true;
      return { get: () => null };
    },
  };

  await assertJsonResponse(await POST(request), 401, {
    success: false,
    message: AUTH_REQUIRED_MESSAGE,
  });
  assert.equal(parsed, false);
});

test("POST returns a safe error when auth fails", async () => {
  const { POST } = createPrivateHandlers({
    auth: async () => {
      throw new Error("private auth provider details");
    },
  });

  await assertJsonResponse(await POST(createFormRequest()), 500, {
    success: false,
    message: "Unable to save the verified visit photo.",
  });
});

test("POST preserves an exact service error status and message", async () => {
  const message = "You must be within 150 metres of the attraction to verify this visit.";
  const { POST } = createPrivateHandlers({
    verifyVisitPhoto: async () => {
      throw new VerifiedVisitServiceError(message, 400);
    },
  });

  await assertJsonResponse(
    await POST(createFormRequest({ photo: createPhotoFile() })),
    400,
    { success: false, message }
  );
});

for (const [label, overrides] of [
  ["database", { connectToDatabase: async () => { throw new Error("database secret"); } }],
  ["service", { verifyVisitPhoto: async () => { throw new Error("service stack"); } }],
]) {
  test(`POST returns safe JSON for an unexpected ${label} failure`, async () => {
    const { POST } = createPrivateHandlers(overrides);

    await assertJsonResponse(
      await POST(createFormRequest({ photo: createPhotoFile() })),
      500,
      { success: false, message: "Unable to save the verified visit photo." }
    );
  });
}

test("public GET leaves a missing session anonymous", async () => {
  let serviceArguments;
  const GET = createPublicHandler({
    auth: async () => null,
    getPublicVerifiedPhotos: async (...args) => {
      serviceArguments = args;
      return [];
    },
  });

  await assertJsonResponse(
    await GET(null, { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) }),
    200,
    { success: true, data: [] }
  );
  assert.deepEqual(serviceArguments, ["507f1f77bcf86cd799439011", undefined]);
});

test("public GET treats an invalid session shape as anonymous", async () => {
  let viewerSubject = "not-called";
  const GET = createPublicHandler({
    auth: async () => ({ user: { id: 123 } }),
    getPublicVerifiedPhotos: async (_attractionId, googleId) => {
      viewerSubject = googleId;
      return [];
    },
  });

  const response = await GET(null, {
    params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }),
  });

  assert.equal(response.status, 200);
  assert.equal(viewerSubject, undefined);
});

test("public GET remains public when the optional auth helper fails", async () => {
  let serviceArguments;
  const GET = createPublicHandler({
    auth: async () => {
      throw new Error("auth provider outage details");
    },
    getPublicVerifiedPhotos: async (...args) => {
      serviceArguments = args;
      return [];
    },
  });

  await assertJsonResponse(
    await GET(null, { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) }),
    200,
    { success: true, data: [] }
  );
  assert.deepEqual(serviceArguments, ["507f1f77bcf86cd799439011", undefined]);
});

test("public GET passes the provider subject only to compute canDelete", async () => {
  let serviceArguments;
  const GET = createPublicHandler({
    auth: async () => ({ user: { id: "google-subject-1" } }),
    getPublicVerifiedPhotos: async (...args) => {
      serviceArguments = args;
      return [];
    },
  });

  await GET(null, { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) });

  assert.deepEqual(serviceArguments, [
    "507f1f77bcf86cd799439011",
    "google-subject-1",
  ]);
});

test("public GET preserves the service invalid-ID response", async () => {
  const GET = createPublicHandler({
    getPublicVerifiedPhotos: async () => {
      throw new VerifiedVisitServiceError("A valid attraction ID is required.", 400);
    },
  });

  await assertJsonResponse(
    await GET(null, { params: Promise.resolve({ id: "not-an-object-id" }) }),
    400,
    { success: false, message: "A valid attraction ID is required." }
  );
});

test("public GET returns only the safe service result", async () => {
  const cards = [{
    visitId: "visit-1",
    photoId: "photo-1",
    attractionId: "507f1f77bcf86cd799439011",
    photoUrl: "https://images.example/verified.jpg",
    capturedDate: "2026-08-16T08:00:00.000Z",
    user: { displayName: "Visitor", avatarUrl: "https://images.example/avatar.jpg" },
    verified: true,
    canDelete: false,
  }];
  const GET = createPublicHandler({ getPublicVerifiedPhotos: async () => cards });

  const response = await GET(null, {
    params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, data: cards });
  assert.deepEqual(Object.keys(body).sort(), ["data", "success"]);
  const serialized = JSON.stringify(body);
  for (const privateField of [
    "googleId",
    "userId",
    "cloudinaryPublicId",
    "latitude",
    "longitude",
    "accuracyMeters",
    "distanceMeters",
  ]) {
    assert.equal(serialized.includes(privateField), false);
  }
});

test("public GET exposes exact safe card keys in newest-first order", async () => {
  const attractionId = "507f1f77bcf86cd799439011";
  const service = createVerifiedVisitService({
    isValidObjectId: (value) => value === attractionId,
    findPublicVerifiedPhotos: async () => [
      {
        _id: "visit-older",
        user: {
          displayName: "Older visitor",
          name: "Private fallback",
          profilePicture: "https://images.example/older-avatar.jpg",
          email: "private@example.test",
        },
        canDelete: false,
        photos: [{
          _id: "photo-older",
          photoUrl: "https://images.example/older.jpg",
          capturedAt: "2026-08-15T08:00:00.000Z",
          latitude: 2.1944,
          cloudinaryPublicId: "private/older",
        }],
      },
      {
        _id: "visit-newer",
        user: {
          displayName: "Newer visitor",
          profilePicture: "https://images.example/newer-avatar.jpg",
        },
        canDelete: true,
        photos: [{
          _id: "photo-newer",
          photoUrl: "https://images.example/newer.jpg",
          capturedAt: "2026-08-15T12:00:00.000Z",
          distanceMeters: 12,
          accuracyMeters: 8,
        }],
      },
    ],
  });
  const GET = createPublicHandler({
    getPublicVerifiedPhotos: service.getPublicVerifiedPhotos,
  });

  const response = await GET(null, { params: Promise.resolve({ id: attractionId }) });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.data.map((card) => card.photoId), ["photo-newer", "photo-older"]);
  for (const card of body.data) {
    assert.deepEqual(Object.keys(card).sort(), [
      "attractionId",
      "canDelete",
      "capturedDate",
      "photoId",
      "photoUrl",
      "user",
      "verified",
      "visitId",
    ]);
    assert.deepEqual(Object.keys(card.user).sort(), ["avatarUrl", "displayName"]);
  }
  assert.equal(JSON.stringify(body).includes("cloudinaryPublicId"), false);
  assert.equal(JSON.stringify(body).includes("latitude"), false);
  assert.equal(JSON.stringify(body).includes("accuracyMeters"), false);
  assert.equal(JSON.stringify(body).includes("distanceMeters"), false);
  assert.equal(JSON.stringify(body).includes("email"), false);
});

test("public photo presentation normalises API cards and builds the owner delete URL", async () => {
  const {
    buildVerifiedPhotoDeleteUrl,
    formatMalaysiaDisplayDate,
    normaliseVerifiedPhotosPayload,
  } = await import("../src/presentation/lib/verifiedVisitorPhotosPresentation.js");

  const cards = normaliseVerifiedPhotosPayload({
    success: true,
    data: [
      {
        visitId: "visit/older",
        photoId: "photo older",
        attractionId: "attraction-1",
        photoUrl: "https://images.example/older.jpg",
        capturedDate: "2026-08-15T08:00:00.000Z",
        user: { displayName: "Older visitor", avatarUrl: "" },
        verified: true,
        canDelete: false,
      },
      {
        visitId: "visit/newer",
        photoId: "photo newer",
        attractionId: "attraction-1",
        photoUrl: "https://images.example/newer.jpg",
        capturedDate: "2026-08-15T16:30:00.000Z",
        user: { displayName: "Newer visitor", avatarUrl: "" },
        verified: true,
        canDelete: true,
      },
    ],
  });

  assert.deepEqual(cards.map((card) => card.photoId), ["photo newer", "photo older"]);
  assert.equal(formatMalaysiaDisplayDate(cards[0].capturedDate), "16 August 2026");
  assert.equal(
    buildVerifiedPhotoDeleteUrl(cards[0]),
    "/api/exploration-map/verified-visits/visit%2Fnewer/photos/photo%20newer"
  );
  assert.throws(
    () => normaliseVerifiedPhotosPayload({
      success: true,
      data: [{ ...cards[0], verified: false }],
    }),
    /could not be loaded/i
  );
});

for (const [label, overrides] of [
  ["database", { connectToDatabase: async () => { throw new Error("private URI"); } }],
  ["service", { getPublicVerifiedPhotos: async () => { throw new Error("private fields"); } }],
]) {
  test(`public GET returns safe JSON for an unexpected ${label} failure`, async () => {
    const GET = createPublicHandler(overrides);

    await assertJsonResponse(
      await GET(null, { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) }),
      500,
      { success: false, message: "Unable to load verified visit photos." }
    );
  });
}

test("DELETE rejects a missing session", async () => {
  const DELETE = createDeleteHandler({ auth: async () => null });

  await assertJsonResponse(
    await DELETE(null, { params: Promise.resolve({ visitId: "visit-1", photoId: "photo-1" }) }),
    401,
    { success: false, message: AUTH_REQUIRED_MESSAGE }
  );
});

test("DELETE rejects an invalid session shape", async () => {
  const DELETE = createDeleteHandler({ auth: async () => ({ user: { id: false } }) });

  await assertJsonResponse(
    await DELETE(null, { params: Promise.resolve({ visitId: "visit-1", photoId: "photo-1" }) }),
    401,
    { success: false, message: AUTH_REQUIRED_MESSAGE }
  );
});

test("DELETE returns a safe error when auth fails", async () => {
  const DELETE = createDeleteHandler({
    auth: async () => {
      throw new Error("private auth details");
    },
  });

  await assertJsonResponse(
    await DELETE(null, { params: Promise.resolve({ visitId: "visit-1", photoId: "photo-1" }) }),
    500,
    { success: false, message: "Unable to delete the verified visit photo." }
  );
});

test("DELETE preserves the service response for another user's photo", async () => {
  const message = "You can only delete your own verified photos.";
  const DELETE = createDeleteHandler({
    deleteOwnedVerifiedPhoto: async () => {
      throw new VerifiedVisitServiceError(message, 403);
    },
  });

  await assertJsonResponse(
    await DELETE(null, {
      params: Promise.resolve({
        visitId: "507f1f77bcf86cd799439012",
        photoId: "507f1f77bcf86cd799439013",
      }),
    }),
    403,
    { success: false, message }
  );
});

test("DELETE awaits route IDs, uses only the session identity, and returns an empty 204", async () => {
  let serviceInput;
  const DELETE = createDeleteHandler({
    deleteOwnedVerifiedPhoto: async (input) => {
      serviceInput = input;
    },
  });

  const response = await DELETE(null, {
    params: Promise.resolve({
      visitId: "507f1f77bcf86cd799439012",
      photoId: "507f1f77bcf86cd799439013",
      userId: "client-controlled-mongo-id",
    }),
  });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("content-type"), null);
  assert.deepEqual(serviceInput, {
    googleId: "google-subject-1",
    visitId: "507f1f77bcf86cd799439012",
    photoId: "507f1f77bcf86cd799439013",
  });
});

for (const [label, remainingPhotos, expectedEmptyDeletes] of [
  ["final photo", [], ["507f1f77bcf86cd799439012"]],
  ["one of several photos", [{ _id: "507f1f77bcf86cd799439014" }], []],
]) {
  test(`DELETE ${label} removes the asset and keeps the dated visit only when non-empty`, async () => {
    const deletedAssets = [];
    const emptyDeletes = [];
    const service = createVerifiedVisitService({
      isValidObjectId: (value) => /^[a-f\d]{24}$/i.test(value),
      findUserByGoogleId: async () => ({ _id: "507f1f77bcf86cd799439010" }),
      findOwnedPhotoForDeletion: async () => ({
        cloudinaryPublicId: "private/verified-photo",
      }),
      deleteCloudinaryImage: async (publicId) => deletedAssets.push(publicId),
      removeOwnedPhoto: async () => ({
        _id: "507f1f77bcf86cd799439012",
        photos: remainingPhotos,
      }),
      deleteVisitWhenEmpty: async (visitId) => emptyDeletes.push(visitId),
    });
    const DELETE = createDeleteHandler({
      deleteOwnedVerifiedPhoto: service.deleteOwnedVerifiedPhoto,
    });

    const response = await DELETE(null, {
      params: Promise.resolve({
        visitId: "507f1f77bcf86cd799439012",
        photoId: "507f1f77bcf86cd799439013",
      }),
    });

    assert.equal(response.status, 204);
    assert.deepEqual(deletedAssets, ["private/verified-photo"]);
    assert.deepEqual(emptyDeletes, expectedEmptyDeletes);
  });
}

for (const [label, overrides] of [
  ["database", { connectToDatabase: async () => { throw new Error("database details"); } }],
  ["service", { deleteOwnedVerifiedPhoto: async () => { throw new Error("service details"); } }],
]) {
  test(`DELETE returns safe JSON for an unexpected ${label} failure`, async () => {
    const DELETE = createDeleteHandler(overrides);

    await assertJsonResponse(
      await DELETE(null, {
        params: Promise.resolve({
          visitId: "507f1f77bcf86cd799439012",
          photoId: "507f1f77bcf86cd799439013",
        }),
      }),
      500,
      { success: false, message: "Unable to delete the verified visit photo." }
    );
  });
}
