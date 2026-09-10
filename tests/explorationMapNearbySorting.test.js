import assert from "node:assert/strict";
import test from "node:test";
import * as explorationMapService from "../src/business/services/explorationMapService.js";
import * as explorationMapPresentation from "../src/presentation/lib/explorationMapPresentation.js";
import {
  createLiveLocationController,
  stopLiveLocationForUnavailableMap,
} from "../src/presentation/lib/liveLocationPresentation.js";

function requireFunction(moduleNamespace, exportName) {
  assert.equal(
    typeof moduleNamespace[exportName],
    "function",
    `${exportName} must be exported as a function`
  );
  return moduleNamespace[exportName];
}

const canonicalAttractions = [
  {
    id: "far",
    name: "Far attraction",
    latitude: 0,
    longitude: 0.02,
    isVisited: false,
  },
  {
    id: "near",
    name: "Near attraction",
    latitude: 0,
    longitude: 0.005,
    isVisited: true,
  },
  {
    id: "middle",
    name: "Middle attraction",
    latitude: 0,
    longitude: 0.01,
    isVisited: false,
  },
];

function createGeolocationFake() {
  const watches = [];
  const clearedWatchIds = [];

  return {
    watches,
    clearedWatchIds,
    watchPosition(onSuccess, onError, options) {
      const watch = { id: watches.length + 1, onSuccess, onError, options };
      watches.push(watch);
      return watch.id;
    },
    clearWatch(watchId) {
      clearedWatchIds.push(watchId);
    },
  };
}

function createRetainedPositionHarness() {
  const geolocation = createGeolocationFake();
  let overlayClearCount = 0;
  const controller = createLiveLocationController({
    geolocation,
    onClear() {
      overlayClearCount += 1;
    },
  });

  return {
    controller,
    geolocation,
    getOverlayClearCount: () => overlayClearCount,
  };
}

const firstSuccessfulBrowserPosition = {
  coords: { latitude: 0, longitude: 0, accuracy: 10 },
};

const movedBrowserPosition = {
  coords: { latitude: 0, longitude: 0.021, accuracy: 8 },
};

test("a ready map gives the Attractions panel no failure message", () => {
  const getMessageKey = requireFunction(
    explorationMapPresentation,
    "getAttractionsPanelMapStatusMessageKey"
  );

  assert.equal(getMessageKey("ready"), null);
});

test("a genuinely unavailable map keeps the localized fallback key", () => {
  const getMessageKey = requireFunction(
    explorationMapPresentation,
    "getAttractionsPanelMapStatusMessageKey"
  );

  assert.equal(getMessageKey("unavailable"), "mapFailed");
  assert.equal(getMessageKey("loading"), "mapLoading");
  assert.equal(getMessageKey("idle"), "mapLoading");
});

test("a successful retry clears the previous map failure presentation", () => {
  const getMessageKey = requireFunction(
    explorationMapPresentation,
    "getAttractionsPanelMapStatusMessageKey"
  );

  assert.equal(getMessageKey("unavailable"), "mapFailed");
  assert.equal(getMessageKey("loading"), "mapLoading");
  assert.equal(getMessageKey("ready"), null);
});

test("initial and invalid live positions preserve canonical order without distances", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );

  for (const position of [
    null,
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: Number.NaN },
  ]) {
    const ordered = orderAttractions(canonicalAttractions, position);
    assert.deepEqual(
      ordered.map((attraction) => attraction.id),
      ["far", "near", "middle"]
    );
    assert.equal(
      ordered.some((attraction) => "distanceMeters" in attraction),
      false
    );
  }
});

test("Haversine distance matches a known one-degree equatorial distance", () => {
  const calculateDistance = requireFunction(
    explorationMapService,
    "calculateHaversineDistanceMeters"
  );

  const distance = calculateDistance(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 }
  );

  assert.ok(Math.abs(distance - 111194.93) < 0.02);
});

test("the first valid live position sorts nearest to farthest using numeric distance", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const ordered = orderAttractions(canonicalAttractions, {
    latitude: 0,
    longitude: 0,
  });

  assert.deepEqual(
    ordered.map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );
  assert.ok(ordered[0].distanceMeters < ordered[1].distanceMeters);
  assert.ok(ordered[1].distanceMeters < ordered[2].distanceMeters);
  assert.deepEqual(
    canonicalAttractions.map((attraction) => attraction.id),
    ["far", "near", "middle"]
  );
});

test("equal distances keep their original stable order", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const ordered = orderAttractions(
    [
      { id: "first", latitude: 0, longitude: 0.01 },
      { id: "second", latitude: 0, longitude: -0.01 },
    ],
    { latitude: 0, longitude: 0 }
  );

  assert.deepEqual(
    ordered.map((attraction) => attraction.id),
    ["first", "second"]
  );
});

test("missing and invalid attraction coordinates sort last and remain stable", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const ordered = orderAttractions(
    [
      { id: "missing", longitude: 0.01 },
      { id: "far", latitude: 0, longitude: 0.02 },
      { id: "invalid", latitude: "", longitude: 0.01 },
      { id: "near", latitude: 0, longitude: 0.005 },
    ],
    { latitude: 0, longitude: 0 }
  );

  assert.deepEqual(
    ordered.map((attraction) => attraction.id),
    ["near", "far", "missing", "invalid"]
  );
  assert.equal(ordered[2].distanceMeters, null);
  assert.equal(ordered[3].distanceMeters, null);
});

test("updated and retained positions recalculate order while a new instance restores canonical order", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const firstPositionOrder = orderAttractions(canonicalAttractions, {
    latitude: 0,
    longitude: 0,
  });
  const updatedPositionOrder = orderAttractions(canonicalAttractions, {
    latitude: 0,
    longitude: 0.021,
  });
  const newInstanceOrder = orderAttractions(canonicalAttractions, null);

  assert.deepEqual(
    firstPositionOrder.map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );
  assert.deepEqual(
    updatedPositionOrder.map((attraction) => attraction.id),
    ["far", "middle", "near"]
  );
  assert.deepEqual(
    newInstanceOrder.map((attraction) => attraction.id),
    ["far", "near", "middle"]
  );
});

test("stop removes tracking overlays but retains distance sorting and shared numbering", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const harness = createRetainedPositionHarness();
  harness.controller.start();
  harness.geolocation.watches[0].onSuccess(firstSuccessfulBrowserPosition);
  harness.controller.stop();
  const snapshot = harness.controller.getSnapshot();
  const ordered = orderAttractions(
    canonicalAttractions,
    snapshot.lastSuccessfulPosition
  );
  const markerTitles = ordered.map((attraction, index) =>
    explorationMapPresentation.getMapMarkerPresentation(
      { ...attraction, isVisited: false },
      index
    ).title
  );

  assert.deepEqual(harness.geolocation.clearedWatchIds, [1]);
  assert.equal(harness.getOverlayClearCount(), 1);
  assert.equal(snapshot.position, null);
  assert.deepEqual(
    ordered.map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );
  assert.match(markerTitles[0], /^1\. Near attraction/u);
  assert.match(markerTitles[1], /^2\. Middle attraction/u);
  assert.match(markerTitles[2], /^3\. Far attraction/u);
});

test("failure before first success keeps canonical order while later failure retains sorting", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const neverLocated = createRetainedPositionHarness();
  neverLocated.controller.start();
  neverLocated.geolocation.watches[0].onError({ code: 1 });

  assert.deepEqual(
    orderAttractions(
      canonicalAttractions,
      neverLocated.controller.getSnapshot().lastSuccessfulPosition
    ).map((attraction) => attraction.id),
    ["far", "near", "middle"]
  );

  const locatedThenFailed = createRetainedPositionHarness();
  locatedThenFailed.controller.start();
  locatedThenFailed.geolocation.watches[0].onSuccess(
    firstSuccessfulBrowserPosition
  );
  locatedThenFailed.geolocation.watches[0].onError({ code: 3 });

  assert.deepEqual(
    orderAttractions(
      canonicalAttractions,
      locatedThenFailed.controller.getSnapshot().lastSuccessfulPosition
    ).map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );
});

test("map unavailability retains the last distance while restart success replaces it", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const harness = createRetainedPositionHarness();
  harness.controller.start();
  harness.geolocation.watches[0].onSuccess(firstSuccessfulBrowserPosition);

  assert.equal(
    stopLiveLocationForUnavailableMap(harness.controller, "unavailable"),
    true
  );
  assert.deepEqual(
    orderAttractions(
      canonicalAttractions,
      harness.controller.getSnapshot().lastSuccessfulPosition
    ).map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );

  harness.controller.start();
  harness.geolocation.watches[1].onSuccess(movedBrowserPosition);
  assert.deepEqual(
    orderAttractions(
      canonicalAttractions,
      harness.controller.getSnapshot().lastSuccessfulPosition
    ).map((attraction) => attraction.id),
    ["far", "middle", "near"]
  );
});

test("distance formatting is localized and does not expose false metre precision", () => {
  const formatDistance = requireFunction(
    explorationMapPresentation,
    "formatApproximateDistance"
  );

  assert.equal(formatDistance(847, "en"), "Approx. 850 m away");
  assert.equal(formatDistance(847, "zh"), "约 850 米");
  assert.equal(formatDistance(847, "ms"), "Kira-kira 850 m");
  assert.equal(formatDistance(2380, "en"), "Approx. 2.4 km away");
  assert.equal(formatDistance(2380, "zh"), "约 2.4 公里");
  assert.equal(formatDistance(2380, "ms"), "Kira-kira 2.4 km");
  assert.equal(formatDistance(null, "en"), null);
  assert.equal(formatDistance(Number.NaN, "en"), null);
});

test("list and marker numbering derive from the same distance-ordered collection", () => {
  const orderAttractions = requireFunction(
    explorationMapService,
    "orderAttractionsByDistance"
  );
  const ordered = orderAttractions(canonicalAttractions, {
    latitude: 0,
    longitude: 0,
  });
  const markerTitles = ordered.map((attraction, index) =>
    explorationMapPresentation.getMapMarkerPresentation(
      { ...attraction, isVisited: false },
      index
    ).title
  );

  assert.deepEqual(
    ordered.map((attraction) => attraction.id),
    ["near", "middle", "far"]
  );
  assert.match(markerTitles[0], /^1\. Near attraction/u);
  assert.match(markerTitles[1], /^2\. Middle attraction/u);
  assert.match(markerTitles[2], /^3\. Far attraction/u);
});
