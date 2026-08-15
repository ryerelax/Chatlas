import assert from "node:assert/strict";
import test from "node:test";
import { createVerifiedVisitRepository } from "../src/data/repositories/verifiedVisitRepository.js";

const photo = {
  photoUrl: "https://example.test/photo.jpg",
  cloudinaryPublicId: "verified-visits/photo-1",
  capturedAt: new Date("2026-08-15T10:00:00.000Z"),
  latitude: 2.193,
  longitude: 102.248,
  accuracyMeters: 12,
  distanceMeters: 34,
};

function chain(result, observed) {
  return {
    select(value) {
      observed.select = value;
      return this;
    },
    sort(value) {
      observed.sort = value;
      return this;
    },
    populate(value) {
      observed.populate = value;
      return this;
    },
    lean: async () => result,
  };
}

test("append uses user, attraction, date, and an atomic fewer-than-three filter", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { filter, update, options });
      return chain({ _id: "visit-1", photos: [update.$push.photos] }, observed);
    },
  });

  const result = await repository.appendPhotoToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photo,
  });

  assert.deepEqual(observed.filter, {
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    "photos.2": { $exists: false },
  });
  assert.deepEqual(observed.update, {
    $setOnInsert: {
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
    },
    $push: { photos: photo },
  });
  assert.deepEqual(observed.options, { upsert: true, new: true, runValidators: true });
  assert.equal(result._id, "visit-1");
});

test("append returns null only when an atomic full-group upsert collides", async () => {
  const duplicateKeyError = Object.assign(new Error("duplicate visit group"), { code: 11000 });
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate() {
      throw duplicateKeyError;
    },
  });

  const result = await repository.appendPhotoToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photo,
  });

  assert.equal(result, null);
});

test("append rethrows database errors other than a full-group duplicate collision", async () => {
  const connectionError = new Error("database unavailable");
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate() {
      throw connectionError;
    },
  });

  await assert.rejects(
    repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
      photo,
    }),
    connectionError
  );
});

test("distinct verified attraction IDs are stringified and deduplicated", async () => {
  const repository = createVerifiedVisitRepository({
    distinct(field, filter) {
      assert.equal(field, "attractionId");
      assert.deepEqual(filter, { userId: "user-1" });
      return Promise.resolve([
        { toString: () => "attraction-1" },
        { toString: () => "attraction-1" },
        { toString: () => "attraction-2" },
      ]);
    },
  });

  assert.deepEqual(await repository.findDistinctVerifiedAttractionIds("user-1"), [
    "attraction-1",
    "attraction-2",
  ]);
});

test("public verified photos use newest-first ordering and a safe populated projection", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    find(filter) {
      observed.filter = filter;
      return chain([{ _id: "visit-1" }], observed);
    },
  });

  const result = await repository.findPublicVerifiedPhotos("attraction-1");

  assert.deepEqual(observed.filter, { attractionId: "attraction-1" });
  assert.deepEqual(observed.sort, { visitDateKey: -1, createdAt: -1, _id: -1 });
  assert.equal(
    observed.select,
    "_id userId visitDateKey photos._id photos.photoUrl photos.capturedAt createdAt"
  );
  assert.deepEqual(observed.populate, {
    path: "userId",
    select: "displayName name profilePicture -_id",
  });
  assert.ok(!observed.select.includes("latitude"));
  assert.ok(!observed.select.includes("longitude"));
  assert.ok(!observed.select.includes("accuracyMeters"));
  assert.ok(!observed.select.includes("distanceMeters"));
  assert.ok(!observed.select.includes("cloudinaryPublicId"));
  assert.deepEqual(result, [{ _id: "visit-1" }]);
});

test("owner-scoped removal returns the deleted private photo with the updated visit", async () => {
  const observed = {};
  const existingVisit = { _id: "visit-1", photos: [{ _id: "photo-1", ...photo }] };
  const updatedVisit = { _id: "visit-1", photos: [] };
  const repository = createVerifiedVisitRepository({
    findOne(filter) {
      observed.lookupFilter = filter;
      return chain(existingVisit, observed);
    },
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { updateFilter: filter, update, options });
      return chain(updatedVisit, observed);
    },
  });

  const result = await repository.removeOwnedPhoto({
    userId: "user-1",
    visitId: "visit-1",
    photoId: "photo-1",
  });

  const ownerScope = { _id: "visit-1", userId: "user-1", "photos._id": "photo-1" };
  assert.deepEqual(observed.lookupFilter, ownerScope);
  assert.deepEqual(observed.updateFilter, ownerScope);
  assert.deepEqual(observed.update, { $pull: { photos: { _id: "photo-1" } } });
  assert.deepEqual(observed.options, { new: true });
  assert.deepEqual(result, { visit: updatedVisit, removedPhoto: existingVisit.photos[0] });
});

test("owner-scoped removal returns null when no matching owned photo exists", async () => {
  const repository = createVerifiedVisitRepository({
    findOne() {
      return chain(null, {});
    },
  });

  assert.equal(
    await repository.removeOwnedPhoto({ userId: "user-1", visitId: "visit-1", photoId: "photo-1" }),
    null
  );
});

test("empty-visit cleanup only deletes a visit whose photos array is empty", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    deleteOne(filter) {
      observed.filter = filter;
      return Promise.resolve({ deletedCount: 1 });
    },
  });

  const result = await repository.deleteVisitWhenEmpty("visit-1");

  assert.deepEqual(observed.filter, { _id: "visit-1", photos: { $size: 0 } });
  assert.equal(result, undefined);
});
