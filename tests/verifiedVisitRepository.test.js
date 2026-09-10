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

function pushedPhotos(update) {
  const pushed = update.$push.photos;
  return Array.isArray(pushed?.$each) ? pushed.$each : [pushed];
}

test("verified visit schema protects private evidence and atomically reserves submission keys across dates", async () => {
  const datedGroupIndex = VerifiedVisit.schema.indexes().find(([keys, options]) =>
    keys.userId === 1 &&
    keys.attractionId === 1 &&
    keys.visitDateKey === 1 &&
    options.unique === true
  );
  const submissionKeyIndex = VerifiedVisit.schema.indexes().find(([keys, options]) =>
    keys.userId === 1 &&
    keys.attractionId === 1 &&
    keys["photos.submissionKey"] === 1 &&
    options.unique === true
  );
  const photoSchema = VerifiedVisit.schema.path("photos").schema;

  assert.deepEqual(datedGroupIndex, [
    { userId: 1, attractionId: 1, visitDateKey: 1 },
    { unique: true },
  ]);
  assert.deepEqual(submissionKeyIndex, [
    { userId: 1, attractionId: 1, "photos.submissionKey": 1 },
    {
      unique: true,
      partialFilterExpression: {
        "photos.submissionKey": { $exists: true },
      },
    },
  ]);
  for (const field of [
    "cloudinaryPublicId",
    "latitude",
    "longitude",
    "accuracyMeters",
    "distanceMeters",
    "submissionKey",
  ]) {
    assert.equal(photoSchema.path(field).options.select, false);
  }

  const legacyVisit = new VerifiedVisit({
    userId: "64b000000000000000000001",
    attractionId: "64b000000000000000000002",
    visitDateKey: "2026-08-15",
    photos: [photo, photo, photo],
  });
  await legacyVisit.validate();
});

test("keyed photo append atomically requires an empty group and excludes an existing key", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { filter, update, options });
      return chain({ _id: "visit-1", photos: pushedPhotos(update) }, observed);
    },
  });
  const submissionKey = "11111111-1111-4111-8111-111111111111";

  await repository.appendPhotoToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    submissionKey,
    photo,
  });

  assert.deepEqual(observed.filter, {
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    "photos.0": { $exists: false },
    "photos.submissionKey": { $ne: submissionKey },
  });
  assert.equal(observed.update.$push.photos.submissionKey, submissionKey);
});

test("concurrent keyed appends allow only one atomic winner", async () => {
  const submissionKey = "11111111-1111-4111-8111-111111111111";
  let visit = null;
  let arrivals = 0;
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const model = {
    findOneAndUpdate(filter, update) {
      return {
        async lean() {
          arrivals += 1;
          if (arrivals === 2) release();
          await barrier;

          const excludesExistingKey = filter["photos.submissionKey"]?.$ne;
          if (
            visit
            && excludesExistingKey
            && visit.photos.some((savedPhoto) =>
              savedPhoto.submissionKey === excludesExistingKey)
          ) {
            return null;
          }

          if (!visit) {
            visit = { _id: "visit-1", photos: [] };
          }
          visit.photos.push(...pushedPhotos(update));
          return { ...visit, photos: [...visit.photos] };
        },
      };
    },
  };
  const repository = createVerifiedVisitRepository(model);
  const input = {
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    submissionKey,
    photo,
  };

  const results = await Promise.all([
    repository.appendPhotoToDatedVisit(input),
    repository.appendPhotoToDatedVisit(input),
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(visit.photos.length, 1);
  assert.equal(visit.photos[0].submissionKey, submissionKey);
});

test("key replay lookup spans Malaysia dates for one user and attraction with an explicit private projection", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOne(filter) {
      observed.filter = filter;
      return chain({ _id: "visit-1", photos: [] }, observed);
    },
  });

  await repository.findDatedVisitBySubmissionKey({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    submissionKey: "11111111-1111-4111-8111-111111111111",
  });

  assert.deepEqual(observed.filter, {
    userId: "user-1",
    attractionId: "attraction-1",
    "photos.submissionKey": "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(
    observed.select,
    "_id attractionId photos._id photos.photoUrl photos.capturedAt +photos.submissionKey"
  );
});

test("empty dated group accepts one photo through one atomic append", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { filter, update, options });
      return chain({ _id: "visit-1", photos: pushedPhotos(update) }, observed);
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
    "photos.0": { $exists: false },
  });
  assert.deepEqual(observed.update.$push, { photos: photo });
  assert.deepEqual(observed.options, { upsert: true, new: true, runValidators: true });
  assert.equal(result._id, "visit-1");
});

test("internal singleton-array compatibility rejects multi-photo new writes", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOneAndUpdate(filter, update, options) {
      Object.assign(observed, { filter, update, options });
      return chain({ _id: "visit-1", photos: pushedPhotos(update) }, observed);
    },
  });

  await assert.rejects(repository.appendPhotosToDatedVisit({
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photos: [photo, photo],
  }), RangeError);

  assert.equal(Object.hasOwn(observed, "update"), false);
});

test("one-photo groups remain independent by attraction and Malaysia date", async () => {
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

      if (existingVisit && existingVisit.photos.length < 1) {
        existingVisit.photos.push(...pushedPhotos(update));
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
        photos: pushedPhotos(update),
      };
      groups.set(key, createdVisit);
      return chain(snapshot(createdVisit), {});
    },
    findOne(filter) {
      const visit = groups.get(groupKey(filter));
      return chain(
        visit?.photos.length >= 1 ? snapshot(visit) : null,
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

  assert.ok(await append("attraction-1", "2026-08-15", 1));
  assert.equal(await append("attraction-1", "2026-08-15", 2), null);
  assert.ok(await append("attraction-2", "2026-08-15", 1));
  assert.ok(await append("attraction-1", "2026-08-16", 1));

  assert.equal(groups.get("user-1|attraction-1|2026-08-15").photos.length, 1);
  assert.equal(groups.get("user-1|attraction-2|2026-08-15").photos.length, 1);
  assert.equal(groups.get("user-1|attraction-1|2026-08-16").photos.length, 1);
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

test("photo append accepts an empty group and rejects one-photo and legacy groups", async (t) => {
  for (const [existingCount, succeeds] of [
    [0, true],
    [1, false],
    [2, false],
    [3, false],
  ]) {
    await t.test(`${existingCount} existing plus one incoming`, async () => {
      const existingPhotos = Array.from({ length: existingCount }, (_, index) => ({
        ...photo,
        photoUrl: `https://example.test/existing-${index + 1}.jpg`,
      }));
      const incomingPhoto = {
        ...photo,
        photoUrl: "https://example.test/incoming-1.jpg",
      };
      let visit = existingCount > 0
        ? { _id: "visit-1", userId: "user-1", attractionId: "attraction-1", visitDateKey: "2026-08-15", photos: existingPhotos }
        : null;
      const model = {
        findOneAndUpdate(filter, update, options) {
          const requiredMissingIndex = Number(
            Object.keys(filter).find((key) => key.startsWith("photos.")).split(".")[1]
          );
          if (visit && visit.photos[requiredMissingIndex] === undefined) {
            visit.photos.push(...pushedPhotos(update));
            return chain({ ...visit, photos: [...visit.photos] }, {});
          }
          if (visit && options.upsert) throw targetVisitDuplicateError();
          if (visit || options.upsert === false) return chain(null, {});
          visit = {
            _id: "visit-1",
            userId: filter.userId,
            attractionId: filter.attractionId,
            visitDateKey: filter.visitDateKey,
            photos: pushedPhotos(update),
          };
          return chain({ ...visit, photos: [...visit.photos] }, {});
        },
        findOne(filter) {
          const requiredExistingIndex = Number(
            Object.keys(filter).find((key) => key.startsWith("photos.")).split(".")[1]
          );
          return chain(visit?.photos[requiredExistingIndex] ? visit : null, {});
        },
      };
      const repository = createVerifiedVisitRepository(model);

      const result = await repository.appendPhotoToDatedVisit({
        userId: "user-1",
        attractionId: "attraction-1",
        visitDateKey: "2026-08-15",
        photo: incomingPhoto,
      });

      assert.equal(Boolean(result), succeeds);
      assert.equal(visit.photos.length, succeeds ? existingCount + 1 : existingCount);
    });
  }
});

test("barrier-overlapped one-photo submissions persist at most one photo", async () => {
  const initialPhotos = [];
  let visit = {
    _id: "visit-1",
    userId: "user-1",
    attractionId: "attraction-1",
    visitDateKey: "2026-08-15",
    photos: initialPhotos,
  };
  let initialAttemptCount = 0;
  let signalBothInitialAttempts;
  let releaseInitialAttempts;
  const bothInitialAttemptsReachedBarrier = new Promise((resolve) => {
    signalBothInitialAttempts = resolve;
  });
  const initialAttemptBarrier = new Promise((resolve) => {
    releaseInitialAttempts = resolve;
  });
  const initialCapacityKeys = [];

  function snapshotVisit() {
    return { ...visit, photos: [...visit.photos] };
  }

  function matchesCapacityPredicate(filter) {
    const capacityKey = Object.keys(filter).find((key) => key.startsWith("photos."));
    if (!capacityKey) return true;
    const photoIndex = Number(capacityKey.split(".")[1]);
    const photoExists = visit.photos[photoIndex] !== undefined;
    return photoExists === filter[capacityKey].$exists;
  }

  const model = {
    findOneAndUpdate(filter, update, options) {
      return {
        async lean() {
          if (options.upsert) {
            const capacityKey = Object.keys(filter).find((key) =>
              key.startsWith("photos.")
            );
            initialCapacityKeys.push(capacityKey);
            initialAttemptCount += 1;
            if (initialAttemptCount === 2) signalBothInitialAttempts();
            await initialAttemptBarrier;
          }

          if (matchesCapacityPredicate(filter)) {
            visit.photos.push(...pushedPhotos(update));
            return snapshotVisit();
          }
          if (options.upsert) throw targetVisitDuplicateError();
          return null;
        },
      };
    },
    findOne(filter) {
      return chain(matchesCapacityPredicate(filter) ? snapshotVisit() : null, {});
    },
  };
  const repository = createVerifiedVisitRepository(model);
  const makePhoto = (prefix) => ({
    ...photo,
    photoUrl: `https://example.test/${prefix}.jpg`,
  });

  const attempts = [
    repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
      photo: makePhoto("first"),
    }),
    repository.appendPhotoToDatedVisit({
      userId: "user-1",
      attractionId: "attraction-1",
      visitDateKey: "2026-08-15",
      photo: makePhoto("second"),
    }),
  ];

  await bothInitialAttemptsReachedBarrier;
  assert.equal(initialAttemptCount, 2);
  assert.equal(visit.photos.length, 0);
  releaseInitialAttempts();
  const results = await Promise.all(attempts);

  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(initialCapacityKeys, ["photos.0", "photos.0"]);
  assert.equal(visit.photos.length, 1);
});

test("dated photo count is isolated by canonical user, attraction, and Malaysia date", async () => {
  const observed = {};
  const repository = createVerifiedVisitRepository({
    findOne(filter) {
      observed.filter = filter;
      return chain({ photos: [{ _id: "photo-1" }, { _id: "photo-2" }] }, observed);
    },
  });

  const count = await repository.findDatedVisitPhotoCount({
    userId: "user-1",
    attractionId: "attraction-2",
    visitDateKey: "2026-08-16",
  });

  assert.equal(count, 2);
  assert.deepEqual(observed.filter, {
    userId: "user-1",
    attractionId: "attraction-2",
    visitDateKey: "2026-08-16",
  });
  assert.equal(observed.select, "photos._id");
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
      return chain({ _id: "visit-1", photos: [photo] }, {});
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
    "photos.0": { $exists: true },
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

test("owner-scoped removal atomically pulls only the owned photo", async () => {
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

test("private verified-attraction metadata groups each attraction with its latest visit date and server verification timestamp", async () => {
  const observed = {};
  const latestVerifiedAt = new Date("2026-08-23T09:08:00.000Z");
  const repository = createVerifiedVisitRepository({
    aggregate(pipeline) {
      observed.pipeline = pipeline;
      return Promise.resolve([
        {
          _id: { toString: () => "attraction-1" },
          latestVisitedDate: "2026-08-23",
          latestVerifiedAt,
        },
      ]);
    },
  });

  const result = await repository.findVerifiedAttractionsWithLatestVisitDate(
    "user-1"
  );

  assert.deepEqual(observed.pipeline, [
    { $match: { userId: "user-1", "photos.0": { $exists: true } } },
    {
      $group: {
        _id: "$attractionId",
        latestVisitedDate: { $max: "$visitDateKey" },
        latestVerifiedAt: { $max: "$createdAt" },
      },
    },
  ]);
  assert.deepEqual(result, [
    {
      attractionId: "attraction-1",
      latestVisitedDate: "2026-08-23",
      latestVerifiedAt,
    },
  ]);
});
