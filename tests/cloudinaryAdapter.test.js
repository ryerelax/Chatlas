import assert from "node:assert/strict";
import test from "node:test";
import {
  createCloudinaryAdapter,
  deleteCloudinaryImage,
  uploadImageFromUrl,
  uploadVerifiedVisitImage,
} from "../src/infrastructure/external/cloudinary.js";

function createFakeClient() {
  const uploads = [];
  const deletes = [];

  return {
    client: {
      uploader: {
        async upload(source, options) {
          uploads.push({ source, options });
          return {
            secure_url: "https://res.cloudinary.com/demo/image/upload/verified.jpg",
            public_id: "chatlas/verified-visits/user-attraction-123",
          };
        },
        async destroy(publicId, options) {
          deletes.push({ publicId, options });
        },
      },
    },
    uploads,
    deletes,
  };
}

test("public Cloudinary exports declare one required argument and are async functions", () => {
  for (const operation of [
    uploadImageFromUrl,
    uploadVerifiedVisitImage,
    deleteCloudinaryImage,
  ]) {
    assert.equal(operation.length, 1);
    assert.equal(operation.constructor.name, "AsyncFunction");
  }
});

test("verified visit uploads return only safe image identifiers with the required transformation", async () => {
  const fake = createFakeClient();
  const adapter = createCloudinaryAdapter(() => fake.client);

  const result = await adapter.uploadVerifiedVisitImage("data:image/jpeg;base64,abc", {
    publicId: "user-attraction-123",
  });

  assert.deepEqual(result, {
    photoUrl: "https://res.cloudinary.com/demo/image/upload/verified.jpg",
    cloudinaryPublicId: "chatlas/verified-visits/user-attraction-123",
  });
  assert.deepEqual(fake.uploads, [{
    source: "data:image/jpeg;base64,abc",
    options: {
      folder: "chatlas/verified-visits",
      public_id: "user-attraction-123",
      overwrite: false,
      resource_type: "image",
      transformation: [
        { width: 1600, height: 1600, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    },
  }]);
});

test("verified visit deletion ignores an empty public ID and deletes a supplied image", async () => {
  const fake = createFakeClient();
  const adapter = createCloudinaryAdapter(() => fake.client);

  await adapter.deleteCloudinaryImage("");
  await adapter.deleteCloudinaryImage("chatlas/verified-visits/user-attraction-123");

  assert.deepEqual(fake.deletes, [{
    publicId: "chatlas/verified-visits/user-attraction-123",
    options: { resource_type: "image" },
  }]);
});

test("legacy URL upload keeps its overwrite behavior and secure URL result", async () => {
  const fake = createFakeClient();
  const adapter = createCloudinaryAdapter(() => fake.client);

  const result = await adapter.uploadImageFromUrl("https://example.test/image.jpg", {
    folder: "chatlas/attractions",
    publicId: "attraction-123",
  });

  assert.equal(result, "https://res.cloudinary.com/demo/image/upload/verified.jpg");
  assert.deepEqual(fake.uploads, [{
    source: "https://example.test/image.jpg",
    options: {
      folder: "chatlas/attractions",
      public_id: "attraction-123",
      overwrite: true,
      resource_type: "image",
    },
  }]);
});
