import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistanceMetres,
  createMalaysiaVisitDateKey,
  evaluateVisitProximity,
  findNearestToQualifyingAttraction,
  findNearbyAttractions,
  normalizeVerificationCategory,
  resolveVerificationRadiusMeters,
  validateGeolocationEvidence,
} from "../src/business/services/visitVerificationRules.js";

const METRES_PER_RADIAN = 6371000;
const latitudeOffset = (metres) => (metres / METRES_PER_RADIAN) * (180 / Math.PI);
const origin = { latitude: 2, longitude: 102 };

test("every supported radius includes its exact boundary and excludes 0.1 metres beyond it", async (t) => {
  for (const radiusMeters of [30, 50, 75, 100, 150]) {
    await t.test(`${radiusMeters} metre radius`, () => {
      const attraction = {
        latitude: 2,
        longitude: 102,
        category: "Future category",
        verificationRadiusMeters: radiusMeters,
      };

      for (const [distanceMeters, qualifies] of [
        [radiusMeters - 0.1, true],
        [radiusMeters, true],
        [radiusMeters + 0.1, false],
      ]) {
        const proximity = evaluateVisitProximity(attraction, {
          latitude: 2 + latitudeOffset(distanceMeters),
          longitude: 102,
        });

        assert.equal(proximity.radiusMeters, radiusMeters);
        assert.equal(proximity.qualifies, qualifies, `${distanceMeters} metres`);
      }
    });
  }
});

test("near-antipodal valid coordinates produce a finite half-circumference distance", () => {
  const distanceMetres = calculateDistanceMetres(
    { latitude: 32.548889484788006, longitude: 45.637068475597516 },
    { latitude: -32.548889484788006, longitude: -134.36293152440248 }
  );

  assert.ok(Number.isFinite(distanceMetres));
  assert.ok(Math.abs(distanceMetres - (Math.PI * METRES_PER_RADIAN)) < 1);
});

test("accuracy accepts 29.9 and 30 metres but rejects 30.1 with measured guidance", () => {
  assert.equal(validateGeolocationEvidence({ ...origin, accuracyMeters: 29.9 }).accuracyMeters, 29.9);
  assert.equal(validateGeolocationEvidence({ ...origin, accuracyMeters: 30 }).accuracyMeters, 30);
  assert.throws(
    () => validateGeolocationEvidence({ ...origin, accuracyMeters: 30.1 }),
    {
      message: "Location accuracy is currently 30.1 metres. Move outdoors and try again. Accuracy must be within 30 metres.",
    }
  );

  assert.throws(
    () => validateGeolocationEvidence({ ...origin, accuracyMeters: 30.01 }),
    {
      message: "Location accuracy is currently 30.01 metres. Move outdoors and try again. Accuracy must be within 30 metres.",
    }
  );
});

test("every specified category has an explicit verification radius mapping", () => {
  for (const [category, radiusMeters] of [
    ["Restaurant", 30],
    ["Cafe", 30],
    ["Food", 30],
    ["Small Shop", 30],
    ["Small Monument", 30],
    ["Museum", 50],
    ["Historical", 50],
    ["Cultural", 50],
    ["Religious", 50],
    ["Architecture", 50],
    ["Entertainment", 75],
    ["Gallery", 50],
    ["Landmark", 50],
    ["Tourist Attraction", 50],
    ["Market", 75],
    ["Shopping Mall", 75],
    ["Indoor Attraction", 75],
    ["Recreation Centre", 75],
    ["Waterfront", 75],
    ["Nature", 100],
    ["Park", 100],
    ["Garden", 100],
    ["Beach", 100],
    ["Zoo", 100],
    ["Theme Park", 100],
    ["Resort", 100],
    ["Large Complex", 100],
    ["Tourism District", 150],
    ["Heritage District", 150],
    ["River Walk", 150],
    ["Jonker Walk", 150],
  ]) {
    assert.equal(resolveVerificationRadiusMeters({ category }), radiusMeters, category);
  }
});

test("category normalization preserves spelling while ignoring case and repeated internal spaces", () => {
  for (const [input, normalized] of [
    ["  rEsTaUrAnT  ", "restaurant"],
    ["TOURIST   Attraction", "tourist attraction"],
    [" Recreation   Centre ", "recreation centre"],
    [" RIVER   walk ", "river walk"],
  ]) {
    assert.equal(normalizeVerificationCategory(input), normalized);
  }

  assert.equal(
    resolveVerificationRadiusMeters({ category: "  jOnKeR   WaLk " }),
    150
  );
});

test("valid overrides win while invalid overrides fall through to category or future fallback", () => {
  assert.equal(
    resolveVerificationRadiusMeters({ category: "Nature", verificationRadiusMeters: 30 }),
    30
  );

  for (const invalidOverride of [29, 151, 50.5, "75", null]) {
    assert.equal(
      resolveVerificationRadiusMeters({ category: "Entertainment", verificationRadiusMeters: invalidOverride }),
      75,
      `invalid override ${String(invalidOverride)}`
    );
  }

  assert.equal(resolveVerificationRadiusMeters({ category: "Future category" }), 50);
});

test("nearby candidate matching returns no results when no attraction reaches its own radius", () => {
  const result = findNearbyAttractions([
    { id: "far", category: "Gallery", latitude: 2 + latitudeOffset(50.1), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result, []);
});

test("nearby candidate matching returns a single qualifying attraction", () => {
  const result = findNearbyAttractions([
    { id: "near", category: "Nature", latitude: 2 + latitudeOffset(100), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result.map(({ attraction }) => attraction.id), ["near"]);
});

test("mixed-radius nearby candidates qualify independently and stay distance-sorted", () => {
  const result = findNearbyAttractions([
    { id: "gallery-outside", category: "Gallery", latitude: 2 + latitudeOffset(50.1), longitude: 102 },
    { id: "nature-inside", category: "Nature", latitude: 2 + latitudeOffset(90), longitude: 102 },
    { id: "entertainment-inside", category: "Entertainment", latitude: 2 + latitudeOffset(60), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(
    result.map(({ attraction, radiusMeters }) => [attraction.id, radiusMeters]),
    [["entertainment-inside", 75], ["nature-inside", 100]]
  );
});

test("nearby candidates are filtered and sorted by calculated distance", () => {
  const result = findNearbyAttractions([
    { id: "far", category: "Gallery", latitude: 2 + latitudeOffset(50.1), longitude: 102 },
    { id: "nearer", category: "Gallery", latitude: 2 + latitudeOffset(20), longitude: 102 },
    { id: "near", category: "Nature", latitude: 2 + latitudeOffset(100), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result.map(({ attraction }) => attraction.id), ["nearer", "near"]);
});

test("nearby candidate matching ignores invalid entries while preserving valid candidates", () => {
  const result = findNearbyAttractions([
    null,
    "not-an-attraction",
    {},
    { id: "valid", category: "Gallery", latitude: 2 + latitudeOffset(20), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result.map(({ attraction }) => attraction.id), ["valid"]);
});

test("nearest-to-qualifying uses distance beyond each radius rather than raw distance", () => {
  const result = findNearestToQualifyingAttraction([
    { id: "closer-but-further-from-qualifying", category: "Gallery", latitude: 2 + latitudeOffset(60), longitude: 102 },
    { id: "best-gap", category: "Nature", latitude: 2 + latitudeOffset(105), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.equal(result.attraction.id, "best-gap");
  assert.equal(result.radiusMeters, 100);
  assert.ok(result.distanceMetres >= 104.99 && result.distanceMetres <= 105.01);
});

test("invalid evidence coordinates fail safely", () => {
  assert.throws(
    () => validateGeolocationEvidence({ latitude: "not-a-coordinate", longitude: 102, accuracyMeters: 20 }),
    /valid current location/i
  );
  assert.throws(
    () => validateGeolocationEvidence({ latitude: 2, longitude: 181, accuracyMeters: 20 }),
    /valid current location/i
  );
});

test("Malaysia date key follows Kuala Lumpur date", () => {
  assert.equal(createMalaysiaVisitDateKey(new Date("2026-08-15T16:30:00.000Z")), "2026-08-16");
});
