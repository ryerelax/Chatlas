import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistanceMetres,
  createMalaysiaVisitDateKey,
  findNearbyAttractions,
  validateGeolocationEvidence,
} from "../src/business/services/visitVerificationRules.js";

const METRES_PER_RADIAN = 6371000;
const latitudeOffset = (metres) => (metres / METRES_PER_RADIAN) * (180 / Math.PI);
const origin = { latitude: 2, longitude: 102 };

test("distance boundaries treat 149 and 150 metres as inside, but 151 as outside", () => {
  assert.ok(
    calculateDistanceMetres(origin, {
      latitude: 2 + latitudeOffset(149),
      longitude: 102,
    }) < 150
  );
  assert.ok(
    calculateDistanceMetres(origin, {
      latitude: 2 + latitudeOffset(150),
      longitude: 102,
    }) <= 150.01
  );
  assert.ok(
    calculateDistanceMetres(origin, {
      latitude: 2 + latitudeOffset(151),
      longitude: 102,
    }) > 150
  );
});

test("accuracy allows 100 and rejects 101 metres", () => {
  assert.equal(validateGeolocationEvidence({ ...origin, accuracyMeters: 100 }).accuracyMeters, 100);
  assert.throws(
    () => validateGeolocationEvidence({ ...origin, accuracyMeters: 101 }),
    /accuracy/i
  );
});

test("nearby candidate matching returns no results when no attraction is within 150 metres", () => {
  const result = findNearbyAttractions([
    { id: "far", latitude: 2 + latitudeOffset(151), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result, []);
});

test("nearby candidate matching returns a single qualifying attraction", () => {
  const result = findNearbyAttractions([
    { id: "near", latitude: 2 + latitudeOffset(100), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result.map(({ attraction }) => attraction.id), ["near"]);
});

test("nearby candidates are filtered and sorted by calculated distance", () => {
  const result = findNearbyAttractions([
    { id: "far", latitude: 2 + latitudeOffset(151), longitude: 102 },
    { id: "nearer", latitude: 2 + latitudeOffset(20), longitude: 102 },
    { id: "near", latitude: 2 + latitudeOffset(100), longitude: 102 },
  ], { ...origin, accuracyMeters: 20 });

  assert.deepEqual(result.map(({ attraction }) => attraction.id), ["nearer", "near"]);
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
