import assert from "node:assert/strict";
import test from "node:test";
import VerifiedVisit from "../src/data/models/VerifiedVisit.js";
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

function targetVisitDuplicateError() {
  return Object.assign(new Error("duplicate visit group"), {
    code: 11000,
    keyPattern: { userId: 1, attractionId: 1, visitDateKey: 1 },
    keyValue: {
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
    },
  });
}

test("verified visit schema protects private photo evidence and has one dated-group unique index", () => {
  const datedGroupIndex = VerifiedVisit.schema.indexes().find(([keys, options]) =>
    keys.userId === 1 &&
    keys.attractionId === 1 &&
    keys.visitDateKey === 1 &&
    options.unique === true
  );
  const photoSchema = VerifiedVisit.schema.path("photos").schema;

  assert.deepEqual(datedGroupIndex, [
    { userId: 1, attractionId: 1, visitDateKey: 1 },
    { unique: true },
  ]);
  for (const field of [
    "cloudinaryPublicId",
    "latitude",
    "longitude",
    "accuracyMeters",
    "distanceMeters",
  ]) {
    assert.equal(photoSchema.path(field).options.select, false);
  }
});

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

test("dated photo groups allow three independently by attraction and Malaysia date", async () => {
  const groups = new Map();
  let visitSequence = 0;

  const groupKey = ({ userId, attractionId, visitDateKey }) =>
    `${userId}|${attractionId}|${visitDateKey}`;
  const snapshot = (visit) => ({
    ...visit,
    photos: [...visit.photos],
  });
  const model = {
    findOneAndUpdate(filter, update, options) {
      const input = {
        userId: filter.userId,
        attractionId: filter.attractionId,
        visitDateKey: filter.visitDateKey,
      };
      const key = groupKey(input);
      const existingVisit = groups.get(key);

      if (existingVisit && existingVisit.photos.length < 3) {
        existingVisit.photos.push(update.$push.photos);
        return chain(snapshot(existingVisit), {});
      }
      if (existingVisit && options.upsert === false) {
        return chain(null, {});
      }
      if (existingVisit) {
        throw Object.assign(targetVisitDuplicateError(), {
          keyValue: input,
        });
      }
      if (options.upsert === false) {
        return chain(null, {});
      }

      const createdVisit = {
        _id: `visit-${++visitSequence}`,
        ...input,
        photos: [update.$push.photos],
      };
      groups.set(key, createdVisit);
      return chain(snapshot(createdVisit), {});
    },
    findOne(filter) {
      const visit = groups.get(groupKey(filter));
      return chain(
        visit?.photos.length >= 3 ? snapshot(visit) : null,
        {}
      );
    },
    distinct(field, filter) {
      assert.equal(field, "attractionId");
      return Promise.resolve(
        [...groups.values()]
          .filter((visit) =>
            visit.userId === filter.userId && visit.photos.length > 0
          )
          .map((visit) => visit.attractionId)
      );
    },
  };
  const repository = createVerifiedVisitRepository(model);

  async function append(attractionId, visitDateKey, photoIndex) {
    return repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId,
      visitDateKey,
      photo: {
        ...photo,
        photoUrl: `https://example.test/${attractionId}-${visitDateKey}-${photoIndex}.jpg`,
      },
    });
  }

  for (let photoIndex = 1; photoIndex <= 3; photoIndex += 1) {
    assert.ok(await append("attraction-1", "2026-08-15", photoIndex));
  }
  assert.equal(await append("attraction-1", "2026-08-15", 4), null);

  for (let photoIndex = 1; photoIndex <= 3; photoIndex += 1) {
    assert.ok(await append("attraction-2", "2026-08-15", photoIndex));
    assert.ok(await append("attraction-1", "2026-08-16", photoIndex));
  }

  assert.equal(groups.get("user-1|attraction-1|2026-08-15").photos.length, 3);
  assert.equal(groups.get("user-1|attraction-2|2026-08-15").photos.length, 3);
  assert.equal(groups.get("user-1|attraction-1|2026-08-16").photos.length, 3);
  assert.match(
    groups.get("user-1|attraction-1|2026-08-15").photos[0].photoUrl,
    /2026-08-15-1\.jpg$/
  );
  assert.deepEqual(
    await repository.findDistinctVerifiedAttractionIds("user-1"),
    ["attraction-1", "attraction-2"]
  );
});

test("append retries a target duplicate-key upsert without upsert when the group has capacity", async () => {
  const observed = [];
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      observed.push({ filter, update, options });
      if (observed.length === 1) {
        throw targetVisitDuplicateError();
      }

      return chain({ _id: "visit-1", photos: [photo] }, {});
    },
  });

  const result = await repository.appendPhotoToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photo,
  });

  assert.equal(result._id, "visit-1");
  assert.equal(observed.length, 2);
  assert.deepEqual(observed[1].filter, observed[0].filter);
  assert.deepEqual(observed[1].options, {
    upsert: false,
    new: true,
    runValidators: true,
  });
});

test("append returns null only after a target duplicate retry confirms the exact group is full", async () => {
  const observed = { updates: [] };
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      observed.updates.push({ filter, update, options });
      if (observed.updates.length === 1) {
        throw targetVisitDuplicateError();
      }

      return chain(null, {});
    },
    findOne(filter) {
      observed.fullFilter = filter;
      return chain({ _id: "visit-1", photos: [photo, photo, photo] }, {});
    },
  });

  const result = await repository.appendPhotoToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photo,
  });

  assert.equal(result, null);
  assert.equal(observed.updates.length, 2);
  assert.deepEqual(observed.fullFilter, {
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    "photos.2": { $exists: true },
  });
});

test("append rethrows a target duplicate when the retry did not confirm a full group", async () => {
  const duplicateKeyError = targetVisitDuplicateError();
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate() {
      throw duplicateKeyError;
    },
    findOne() {
      return chain(null, {});
    },
  });

  await assert.rejects(
    repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
      photo,
    }),
    duplicateKeyError
  );
});

test("append rethrows a non-target unique-index collision", async () => {
  const duplicateKeyError = Object.assign(new Error("other unique collision"), {
    code: 11000,
    keyPattern: { cloudinaryPublicId: 1 },
    keyValue: { cloudinaryPublicId: "verified-visits/photo-1" },
  });
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate() {
      throw duplicateKeyError;
    },
  });

  await assert.rejects(
    repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
      photo,
    }),
    duplicateKeyError
  );
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
      assert.deepEqual(filter, {
        userId: "user-1",
        "photos.0": { $exists: true },
      });
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

test("public verified photos give only the owner a deletion flag without leaking internal user IDs", async () => {
  const observed = {};
  const rawVisits = [{
    _id: "visit-1",
    visitDateKey: "2026-08-15",
    createdAt: "2026-08-15T10:00:00.000Z",
    userId: {
      _id: "user-1",
      displayName: "Owner",
      name: "Owner Name",
      profilePicture: "https://example.test/owner.jpg",
      email: "owner@example.test",
    },
    photos: [{
      _id: "photo-1",
      photoUrl: "https://example.test/photo.jpg",
      capturedAt: "2026-08-15T10:00:00.000Z",
      cloudinaryPublicId: "verified-visits/photo-1",
      latitude: 2.193,
    }],
  }];
  const repository = createVerifiedVisitRepository({
    find(filter) {
      observed.filter = filter;
      return chain(rawVisits, observed);
    },
  });

  const ownerResult = await repository.findPublicVerifiedPhotos("attraction-1", "user-1");
  const nonOwnerResult = await repository.findPublicVerifiedPhotos("attraction-1", "user-2");
  const anonymousResult = await repository.findPublicVerifiedPhotos("attraction-1");

  const publicRecord = {
    _id: "visit-1",
    visitDateKey: "2026-08-15",
    createdAt: "2026-08-15T10:00:00.000Z",
    user: {
      displayName: "Owner",
      name: "Owner Name",
      profilePicture: "https://example.test/owner.jpg",
    },
    photos: [{
      _id: "photo-1",
      photoUrl: "https://example.test/photo.jpg",
      capturedAt: "2026-08-15T10:00:00.000Z",
    }],
  };

  assert.deepEqual(observed.filter, { attractionId: "attraction-1" });
  assert.deepEqual(observed.sort, { visitDateKey: -1, createdAt: -1, _id: -1 });
  assert.equal(
    observed.select,
    "_id userId visitDateKey photos._id photos.photoUrl photos.capturedAt createdAt"
  );
  assert.deepEqual(observed.populate, {
    path: "userId",
    select: "_id displayName name profilePicture",
  });
  assert.ok(!observed.select.includes("latitude"));
  assert.ok(!observed.select.includes("longitude"));
  assert.ok(!observed.select.includes("accuracyMeters"));
  assert.ok(!observed.select.includes("distanceMeters"));
  assert.ok(!observed.select.includes("cloudinaryPublicId"));
  assert.deepEqual(ownerResult, [{ ...publicRecord, canDelete: true }]);
  assert.deepEqual(nonOwnerResult, [{ ...publicRecord, canDelete: false }]);
  assert.deepEqual(anonymousResult, [{ ...publicRecord, canDelete: false }]);
  assert.ok(!Object.hasOwn(ownerResult[0], "userId"));
  assert.ok(!Object.hasOwn(ownerResult[0].user, "_id"));
  assert.ok(!JSON.stringify(ownerResult).includes("owner@example.test"));
  assert.ok(!JSON.stringify(ownerResult).includes("verified-visits/photo-1"));
});

test("owner-scoped private evidence lookup does not mutate the visit", async () => {
  const observed = {};
  const existingVisit = { _id: "visit-1", photos: [{ _id: "photo-1", ...photo }] };
  let updates = 0;
  const repository = createVerifiedVisitRepository({
    findOne(filter) {
      observed.lookupFilter = filter;
      return chain(existingVisit, observed);
    },
    findOneAndUpdate() {
      updates += 1;
      return chain(null, observed);
    },
  });

  const result = await repository.findOwnedPhotoForDeletion({
    userId: "user-1",
    visitId: "visit-1",
    photoId: "photo-1",
  });

  const ownerScope = { _id: "visit-1", userId: "user-1", "photos._id": "photo-1" };
  assert.deepEqual(observed.lookupFilter, ownerScope);
  assert.equal(
    observed.select,
    "+photos.cloudinaryPublicId +photos.latitude +photos.longitude +photos.accuracyMeters +photos.distanceMeters"
  );
  assert.deepEqual(result, { cloudinaryPublicId: photo.cloudinaryPublicId });
  assert.equal(updates, 0);
});

test("owner-scoped private evidence lookup returns null for a non-owner", async () => {
  const repository = createVerifiedVisitRepository({
    findOne() {
      return chain(null, {});
    },
  });

  assert.equal(
    await repository.findOwnedPhotoForDeletion({
      userId: "user-1",
      visitId: "visit-1",
      photoId: "photo-1",
    }),
    null
  );
});

test("owner-scoped removal atomically pulls only the owned photo after external deletion", async () => {
  const observed = {};
  const updatedVisit = { _id: "visit-1", photos: [] };
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { filter, update, options });
      return chain(updatedVisit, observed);
    },
  });

  const result = await repository.removeOwnedPhoto({
    userId: "user-1",
    visitId: "visit-1",
    photoId: "photo-1",
  });

  assert.deepEqual(observed.filter, {
    _id: "visit-1",
    userId: "user-1",
    "photos._id": "photo-1",
  });
  assert.deepEqual(observed.update, { $pull: { photos: { _id: "photo-1" } } });
  assert.deepEqual(observed.options, { new: true });
  assert.deepEqual(result, updatedVisit);
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
