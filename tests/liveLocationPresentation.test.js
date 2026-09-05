import assert from "node:assert/strict";
import test from "node:test";
import * as liveLocationPresentation from "../src/presentation/lib/liveLocationPresentation.js";
import {
  LIVE_LOCATION_STATUS,
  LIVE_LOCATION_WATCH_OPTIONS,
  canStartLiveLocation,
  createLiveLocationController,
  createLiveLocationMapOverlayController,
  getLiveLocationCopy,
  normaliseLiveLocationPosition,
  stopLiveLocationForUnavailableMap,
} from "../src/presentation/lib/liveLocationPresentation.js";

function createGeolocationFake() {
  let nextWatchId = 41;
  const watches = [];
  const clearedWatchIds = [];

  return {
    watches,
    clearedWatchIds,
    watchPosition(onSuccess, onError, options) {
      const watch = {
        id: nextWatchId,
        onSuccess,
        onError,
        options,
      };
      nextWatchId += 1;
      watches.push(watch);
      return watch.id;
    },
    clearWatch(watchId) {
      clearedWatchIds.push(watchId);
    },
  };
}

function createControllerHarness(geolocation = createGeolocationFake()) {
  const states = [];
  const positions = [];
  let clearCount = 0;
  const controller = createLiveLocationController({
    geolocation,
    onStateChange(state) {
      states.push(state);
    },
    onPosition(position, options) {
      positions.push({ position, options });
    },
    onClear() {
      clearCount += 1;
    },
  });

  return {
    controller,
    geolocation,
    positions,
    states,
    getClearCount: () => clearCount,
  };
}

const firstBrowserPosition = {
  coords: {
    latitude: 2.1896,
    longitude: 102.2501,
    accuracy: 18.5,
  },
};

const secondBrowserPosition = {
  coords: {
    latitude: 2.191,
    longitude: 102.252,
    accuracy: 12,
  },
};

test("live location is idle and does not request geolocation before an explicit start", () => {
  const harness = createControllerHarness();

  assert.equal(harness.geolocation.watches.length, 0);
  assert.deepEqual(harness.controller.getSnapshot(), {
    status: LIVE_LOCATION_STATUS.IDLE,
    errorKey: null,
    position: null,
    lastSuccessfulPosition: null,
  });
});

test("explicit start creates one high-accuracy watch and repeated starts do not accumulate watchers", () => {
  const harness = createControllerHarness();

  assert.equal(harness.controller.start(), true);
  assert.equal(harness.controller.start(), false);
  assert.equal(harness.geolocation.watches.length, 1);
  assert.deepEqual(harness.geolocation.watches[0].options, LIVE_LOCATION_WATCH_OPTIONS);
  assert.equal(harness.controller.getSnapshot().status, LIVE_LOCATION_STATUS.REQUESTING);
});

test("the first valid position requests one automatic centre and later positions only update overlays", () => {
  const harness = createControllerHarness();
  harness.controller.start();

  harness.geolocation.watches[0].onSuccess(firstBrowserPosition);
  harness.geolocation.watches[0].onSuccess(secondBrowserPosition);

  assert.deepEqual(harness.positions, [
    {
      position: { latitude: 2.1896, longitude: 102.2501, accuracyMeters: 18.5 },
      options: { shouldCenter: true },
    },
    {
      position: { latitude: 2.191, longitude: 102.252, accuracyMeters: 12 },
      options: { shouldCenter: false },
    },
  ]);
  assert.deepEqual(harness.controller.getSnapshot(), {
    status: LIVE_LOCATION_STATUS.TRACKING,
    errorKey: null,
    position: { latitude: 2.191, longitude: 102.252, accuracyMeters: 12 },
    lastSuccessfulPosition: {
      latitude: 2.191,
      longitude: 102.252,
      accuracyMeters: 12,
    },
  });
});

test("map overlays are created once, auto-centre once, update in place, and recenter on demand", () => {
  const mapCalls = { centres: [], zooms: [] };
  const map = {
    setCenter(position) {
      mapCalls.centres.push(position);
    },
    setZoom(zoom) {
      mapCalls.zooms.push(zoom);
    },
  };
  const markers = [];
  const circles = [];
  const overlay = createLiveLocationMapOverlayController({
    map,
    createMarker(input) {
      const marker = { ...input };
      markers.push(marker);
      return marker;
    },
    createAccuracyCircle(input) {
      const circle = {
        ...input,
        centres: [],
        radii: [],
        maps: [input.map],
        setCenter(value) {
          this.centres.push(value);
        },
        setRadius(value) {
          this.radii.push(value);
        },
        setMap(value) {
          this.maps.push(value);
        },
      };
      circles.push(circle);
      return circle;
    },
  });

  overlay.update(
    { latitude: 2.1896, longitude: 102.2501, accuracyMeters: 18.5 },
    { shouldCenter: true }
  );
  overlay.update(
    { latitude: 2.191, longitude: 102.252, accuracyMeters: 12 },
    { shouldCenter: false }
  );

  assert.equal(markers.length, 1);
  assert.equal(circles.length, 1);
  assert.deepEqual(markers[0].position, { lat: 2.191, lng: 102.252 });
  assert.deepEqual(circles[0].centres, [{ lat: 2.191, lng: 102.252 }]);
  assert.deepEqual(circles[0].radii, [12]);
  assert.deepEqual(mapCalls.centres, [{ lat: 2.1896, lng: 102.2501 }]);
  assert.deepEqual(mapCalls.zooms, [16]);

  assert.equal(overlay.recenter(), true);
  assert.deepEqual(mapCalls.centres, [
    { lat: 2.1896, lng: 102.2501 },
    { lat: 2.191, lng: 102.252 },
  ]);
  assert.deepEqual(mapCalls.zooms, [16, 16]);
});

test("stop clears the active watch and overlays, retains the last position, and ignores stale callbacks", () => {
  const harness = createControllerHarness();
  harness.controller.start();
  const staleSuccess = harness.geolocation.watches[0].onSuccess;
  staleSuccess(firstBrowserPosition);

  assert.equal(harness.controller.stop(), true);
  assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
  assert.equal(harness.getClearCount(), 1);
  assert.deepEqual(harness.controller.getSnapshot(), {
    status: LIVE_LOCATION_STATUS.IDLE,
    errorKey: null,
    position: null,
    lastSuccessfulPosition: {
      latitude: 2.1896,
      longitude: 102.2501,
      accuracyMeters: 18.5,
    },
  });

  staleSuccess(secondBrowserPosition);
  assert.equal(harness.positions.length, 1);
  assert.equal(harness.controller.getSnapshot().status, LIVE_LOCATION_STATUS.IDLE);
  assert.deepEqual(harness.controller.getSnapshot().lastSuccessfulPosition, {
    latitude: 2.1896,
    longitude: 102.2501,
    accuracyMeters: 18.5,
  });
});

test("restart creates one new watcher and replaces the retained position only after new success", () => {
  const harness = createControllerHarness();
  harness.controller.start();
  const staleSuccess = harness.geolocation.watches[0].onSuccess;
  staleSuccess(firstBrowserPosition);
  harness.controller.stop();

  assert.equal(harness.controller.start(), true);
  assert.equal(harness.geolocation.watches.length, 2);
  assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
  assert.deepEqual(harness.controller.getSnapshot().lastSuccessfulPosition, {
    latitude: 2.1896,
    longitude: 102.2501,
    accuracyMeters: 18.5,
  });

  staleSuccess(secondBrowserPosition);
  assert.deepEqual(harness.controller.getSnapshot().lastSuccessfulPosition, {
    latitude: 2.1896,
    longitude: 102.2501,
    accuracyMeters: 18.5,
  });

  harness.geolocation.watches[1].onSuccess(secondBrowserPosition);
  assert.deepEqual(harness.controller.getSnapshot().lastSuccessfulPosition, {
    latitude: 2.191,
    longitude: 102.252,
    accuracyMeters: 12,
  });
  assert.deepEqual(harness.positions.at(-1).options, { shouldCenter: true });
});

test("dispose clears the active browser watch without leaving background tracking", () => {
  const harness = createControllerHarness();
  harness.controller.start();

  harness.controller.dispose();

  assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
  assert.equal(harness.getClearCount(), 1);
});

test("permission, unavailable, and timeout errors clear the watch and allow retry", async (context) => {
  for (const [label, code, errorKey] of [
    ["permission denied", 1, "permissionDenied"],
    ["position unavailable", 2, "positionUnavailable"],
    ["timeout", 3, "timeout"],
  ]) {
    await context.test(label, () => {
      const harness = createControllerHarness();
      harness.controller.start();
      harness.geolocation.watches[0].onError({ code, message: "private browser detail" });

      assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
      assert.equal(harness.controller.getSnapshot().status, LIVE_LOCATION_STATUS.ERROR);
      assert.equal(harness.controller.getSnapshot().errorKey, errorKey);
      assert.equal(harness.controller.getSnapshot().lastSuccessfulPosition, null);
      assert.equal(harness.controller.start(), true);
      assert.equal(harness.geolocation.watches.length, 2);
    });
  }
});

test("unsupported geolocation fails safely without creating a watch", () => {
  const harness = createControllerHarness({});

  assert.equal(harness.controller.start(), false);
  assert.deepEqual(harness.controller.getSnapshot(), {
    status: LIVE_LOCATION_STATUS.ERROR,
    errorKey: "unsupported",
    position: null,
    lastSuccessfulPosition: null,
  });
});

test("an error after a valid position clears active tracking but retains the last success", () => {
  const harness = createControllerHarness();
  harness.controller.start();
  harness.geolocation.watches[0].onSuccess(firstBrowserPosition);

  harness.geolocation.watches[0].onError({ code: 3 });

  assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
  assert.equal(harness.getClearCount(), 1);
  assert.deepEqual(harness.controller.getSnapshot(), {
    status: LIVE_LOCATION_STATUS.ERROR,
    errorKey: "timeout",
    position: null,
    lastSuccessfulPosition: {
      latitude: 2.1896,
      longitude: 102.2501,
      accuracyMeters: 18.5,
    },
  });
});

test("invalid latitude, longitude, and accuracy stop tracking without exposing coordinates", async (context) => {
  for (const [label, position] of [
    ["latitude", { coords: { latitude: 91, longitude: 102, accuracy: 10 } }],
    ["longitude", { coords: { latitude: 2, longitude: 181, accuracy: 10 } }],
    ["accuracy", { coords: { latitude: 2, longitude: 102, accuracy: -1 } }],
  ]) {
    await context.test(label, () => {
      const harness = createControllerHarness();
      harness.controller.start();
      harness.geolocation.watches[0].onSuccess(position);

      assert.equal(harness.controller.getSnapshot().status, LIVE_LOCATION_STATUS.ERROR);
      assert.equal(harness.controller.getSnapshot().errorKey, "invalidPosition");
      assert.equal(harness.controller.getSnapshot().position, null);
      assert.equal(harness.controller.getSnapshot().lastSuccessfulPosition, null);
      assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
    });
  }
});

test("live position validation accepts browser accuracy beyond visit-verification accuracy", () => {
  assert.deepEqual(normaliseLiveLocationPosition({
    coords: { latitude: "2.2", longitude: "102.3", accuracy: "75" },
  }), {
    latitude: 2.2,
    longitude: 102.3,
    accuracyMeters: 75,
  });
});

test("map readiness gates live tracking and prevents watches while the map is unavailable", () => {
  assert.equal(canStartLiveLocation("ready"), true);
  for (const status of ["idle", "loading", "unavailable", null]) {
    assert.equal(canStartLiveLocation(status), false);
  }
});

test("a map becoming unavailable stops the active watch instead of tracking in the background", () => {
  const harness = createControllerHarness();
  harness.controller.start();

  assert.equal(
    stopLiveLocationForUnavailableMap(harness.controller, "loading"),
    false
  );
  assert.deepEqual(harness.geolocation.clearedWatchIds, []);
  assert.equal(
    stopLiveLocationForUnavailableMap(harness.controller, "unavailable"),
    true
  );
  assert.deepEqual(harness.geolocation.clearedWatchIds, [41]);
  assert.equal(harness.controller.getSnapshot().status, LIVE_LOCATION_STATUS.IDLE);
  assert.deepEqual(harness.controller.getSnapshot().lastSuccessfulPosition, null);
});

test("clearing overlays removes both the blue marker and accuracy circle", () => {
  const marker = { map: "map" };
  const circle = {
    maps: [],
    setMap(value) {
      this.maps.push(value);
    },
  };
  const overlay = createLiveLocationMapOverlayController({
    map: {},
    createMarker: () => marker,
    createAccuracyCircle: () => circle,
  });
  overlay.update({ latitude: 2.1896, longitude: 102.2501, accuracyMeters: 18.5 });

  overlay.clear();

  assert.equal(marker.map, null);
  assert.deepEqual(circle.maps, [null]);
  assert.equal(overlay.recenter(), false);
});

test("EN, Chinese, and BM copy covers controls, privacy, errors, and accessible status", () => {
  const expected = {
    en: {
      show: "Show my live location",
      recenter: "Recenter",
      stop: "Stop live location",
      retry: "Retry live location",
      requesting: "Finding your live location…",
      tracking: "Live location is on",
      stoppedLastLocation: "Live location stopped. Distances are based on your last known location.",
      markerLabel: "Your live location",
      controlsLabel: "Live location controls",
      actionsLabel: "Live location actions",
      privacy: "Turn on live location to show your position while this page is open. Your position stays on this device and is not stored or uploaded. Visit verification separately checks your location once. Chatlas does not provide route navigation.",
    },
    zh: {
      show: "显示我的实时位置",
      recenter: "重新居中",
      stop: "停止实时位置",
      retry: "重试实时位置",
      requesting: "正在取得你的实时位置…",
      tracking: "实时位置已开启",
      stoppedLastLocation: "实时定位已停止。距离根据你最后的位置计算。",
      markerLabel: "你的实时位置",
      controlsLabel: "实时位置控制",
      actionsLabel: "实时位置操作",
      privacy: "开启实时位置后，地图会在此页面打开期间显示你的位置。位置只保留在此设备，不会被储存或上传。到访验证会另外进行一次位置检查。Chatlas 不提供路线导航。",
    },
    ms: {
      show: "Tunjukkan lokasi langsung saya",
      recenter: "Pusatkan semula",
      stop: "Hentikan lokasi langsung",
      retry: "Cuba semula lokasi langsung",
      requesting: "Sedang mendapatkan lokasi langsung anda…",
      tracking: "Lokasi langsung dihidupkan",
      stoppedLastLocation: "Lokasi langsung telah dihentikan. Jarak adalah berdasarkan lokasi terakhir anda.",
      markerLabel: "Lokasi langsung anda",
      controlsLabel: "Kawalan lokasi langsung",
      actionsLabel: "Tindakan lokasi langsung",
      privacy: "Hidupkan lokasi langsung untuk memaparkan kedudukan anda semasa halaman ini dibuka. Lokasi kekal pada peranti ini dan tidak disimpan atau dimuat naik. Pengesahan lawatan menyemak lokasi secara berasingan sekali sahaja. Chatlas tidak menyediakan navigasi laluan.",
    },
  };

  for (const [language, labels] of Object.entries(expected)) {
    const copy = getLiveLocationCopy(language);
    for (const [key, value] of Object.entries(labels)) {
      assert.equal(copy[key], value, `${language}.${key}`);
    }
    for (const errorKey of [
      "unsupported",
      "permissionDenied",
      "positionUnavailable",
      "timeout",
      "invalidPosition",
      "mapUnavailable",
    ]) {
      assert.equal(typeof copy.errors[errorKey], "string");
      assert.ok(copy.errors[errorKey].length > 0);
      assert.doesNotMatch(copy.errors[errorKey], /\d+\.\d+[, ]+\d+\.\d+/u);
    }
  }
});

test("stopped last-location status is polite, atomic, and never claims tracking", async (context) => {
  assert.equal(
    typeof liveLocationPresentation.getLiveLocationStatusPresentation,
    "function",
    "getLiveLocationStatusPresentation must be exported as a function"
  );
  const getLiveLocationStatusPresentation =
    liveLocationPresentation.getLiveLocationStatusPresentation;
  const expectedMessages = {
    en: "Live location stopped. Distances are based on your last known location.",
    zh: "实时定位已停止。距离根据你最后的位置计算。",
    ms: "Lokasi langsung telah dihentikan. Jarak adalah berdasarkan lokasi terakhir anda.",
  };

  for (const [language, message] of Object.entries(expectedMessages)) {
    await context.test(language, () => {
      const presentation = getLiveLocationStatusPresentation({
        language,
        status: LIVE_LOCATION_STATUS.IDLE,
        hasLastSuccessfulPosition: true,
      });

      assert.deepEqual(presentation, {
        message,
        role: "status",
        ariaLive: "polite",
        ariaAtomic: true,
      });
      assert.doesNotMatch(
        presentation.message,
        /Live location is on|tracking|updating|实时位置已开启|dihidupkan/iu
      );
    });
  }
});

test("live tracking is browser-only and does not invoke application write APIs", () => {
  const harness = createControllerHarness();
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Live location must not call an application API.");
  };

  try {
    harness.controller.start();
    harness.geolocation.watches[0].onSuccess(firstBrowserPosition);
    harness.controller.stop();

    assert.equal(fetchCalls, 0);
    assert.equal(harness.positions.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
