import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttractionDetailsHref,
  normaliseMapAttractions,
} from "../src/lib/explorationMap.js";

test("normaliseMapAttractions keeps supported attractions with valid coordinates", () => {
  const attractions = normaliseMapAttractions([
    {
      _id: "melaka-1",
      name: "  A Famosa  ",
      address: "Bandar Hilir",
      category: "Historical",
      latitude: "2.1918",
      longitude: 102.2504,
      rating: "4.6",
    },
  ]);

  assert.deepEqual(attractions, [
    {
      id: "melaka-1",
      name: "A Famosa",
      address: "Bandar Hilir",
      category: "Historical",
      latitude: 2.1918,
      longitude: 102.2504,
      rating: 4.6,
    },
  ]);
});

test("normaliseMapAttractions removes records that cannot be placed on the map", () => {
  const attractions = normaliseMapAttractions([
    { _id: "missing-latitude", longitude: 102.25 },
    { _id: "invalid-latitude", latitude: 91, longitude: 102.25 },
    { _id: "invalid-longitude", latitude: 2.19, longitude: 181 },
    { latitude: 2.19, longitude: 102.25 },
  ]);

  assert.deepEqual(attractions, []);
});

test("normaliseMapAttractions returns an empty list for a non-array response", () => {
  assert.deepEqual(normaliseMapAttractions(null), []);
});

test("getAttractionDetailsHref safely encodes the attraction identifier", () => {
  assert.equal(
    getAttractionDetailsHref("melaka place/1"),
    "/attractions/melaka%20place%2F1"
  );
});
