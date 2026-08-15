import assert from "node:assert/strict";
import test from "node:test";
import {
  createVerifiedVisitFormData,
  getCameraErrorMessage,
  getCandidateSelectionMode,
  getGeolocationErrorMessage,
  getNearbyCandidatePresentations,
  getVerificationAuthenticationState,
  normaliseBrowserPosition,
  revokeObjectUrl,
  selectSafeApiMessage,
  stopMediaStream,
} from "../src/presentation/lib/visitVerificationPresentation.js";

const METRES_PER_RADIAN = 6371000;
const latitudeOffset = (metres) =>
  (metres / METRES_PER_RADIAN) * (180 / Math.PI);

test("browser positions are converted to the verified visit evidence shape", () => {
  assert.deepEqual(
    normaliseBrowserPosition({
      coords: { latitude: 2, longitude: 102, accuracy: 20 },
    }),
    { latitude: 2, longitude: 102, accuracyMeters: 20 }
  );
});

test("coercible browser position values are normalised to numbers", () => {
  assert.deepEqual(
    normaliseBrowserPosition({
      coords: { latitude: "2", longitude: "102", accuracy: "20" },
    }),
    { latitude: 2, longitude: 102, accuracyMeters: 20 }
  );
});

test("missing and invalid browser position values fail validation", async (context) => {
  for (const [label, position] of [
    ["missing coordinates", {}],
    [
      "invalid latitude",
      { coords: { latitude: "north", longitude: 102, accuracy: 20 } },
    ],
    [
      "out-of-range longitude",
      { coords: { latitude: 2, longitude: 181, accuracy: 20 } },
    ],
    [
      "insufficient accuracy",
      { coords: { latitude: 2, longitude: 102, accuracy: 101 } },
    ],
  ]) {
    await context.test(label, () => {
      assert.throws(() => normaliseBrowserPosition(position), /location|accuracy/i);
    });
  }
});

test("empty and boolean browser coordinate values are not treated as numeric zero", () => {
  for (const latitude of [null, "", "   ", true, false]) {
    assert.throws(
      () =>
        normaliseBrowserPosition({
          coords: { latitude, longitude: 102, accuracy: 20 },
        }),
      /valid current location/i
    );
  }
});

test("candidate count selects none, automatic, or explicit choice mode", () => {
  assert.equal(getCandidateSelectionMode([]), "none");
  assert.equal(
    getCandidateSelectionMode([{ attraction: { id: "a" } }]),
    "automatic"
  );
  assert.equal(
    getCandidateSelectionMode([
      { attraction: { id: "a" } },
      { attraction: { id: "b" } },
    ]),
    "choose"
  );
  assert.equal(getCandidateSelectionMode(null), "none");
});

test("browser permissions require positively confirmed canonical authentication", () => {
  assert.deepEqual(getVerificationAuthenticationState("success"), {
    authenticationConfirmed: true,
    authenticationPending: false,
    authenticationRequired: false,
    authenticationUnavailable: false,
  });
  assert.deepEqual(getVerificationAuthenticationState("loading"), {
    authenticationConfirmed: false,
    authenticationPending: true,
    authenticationRequired: false,
    authenticationUnavailable: false,
  });
  assert.deepEqual(getVerificationAuthenticationState("auth-required"), {
    authenticationConfirmed: false,
    authenticationPending: false,
    authenticationRequired: true,
    authenticationUnavailable: false,
  });

  for (const visitedDataStatus of ["error", "unavailable", "unknown"]) {
    assert.deepEqual(
      getVerificationAuthenticationState(visitedDataStatus),
      {
        authenticationConfirmed: false,
        authenticationPending: false,
        authenticationRequired: false,
        authenticationUnavailable: true,
      }
    );
  }

  assert.deepEqual(
    getVerificationAuthenticationState("success", {
      developmentPreviewActive: true,
    }),
    {
      authenticationConfirmed: false,
      authenticationPending: false,
      authenticationRequired: false,
      authenticationUnavailable: true,
    }
  );
});

test("nearby candidate presentations stay distance-sorted with readable labels", () => {
  const candidates = getNearbyCandidatePresentations(
    [
      {
        id: "one-hundred-metres",
        name: "Riverside Museum",
        latitude: 2 + latitudeOffset(100),
        longitude: 102,
      },
      {
        id: "same-place",
        name: "Town Square",
        latitude: 2,
        longitude: 102,
      },
      {
        id: "outside-radius",
        name: "Hill View",
        latitude: 2 + latitudeOffset(151),
        longitude: 102,
      },
    ],
    { latitude: 2, longitude: 102, accuracyMeters: 20 }
  );

  assert.deepEqual(
    candidates.map(({ attraction, distanceLabel }) => ({
      id: attraction.id,
      distanceLabel,
    })),
    [
      { id: "same-place", distanceLabel: "0 m away" },
      { id: "one-hundred-metres", distanceLabel: "100 m away" },
    ]
  );
  assert.equal(candidates[0].distanceMetres, 0);
  assert.ok(candidates[1].distanceMetres >= 99.99);
  assert.ok(candidates[1].distanceMetres <= 100.01);
});

test("geolocation browser errors map to actionable public messages", () => {
  assert.match(getGeolocationErrorMessage({ code: 1 }), /denied/i);
  assert.match(getGeolocationErrorMessage({ code: 2 }), /unavailable/i);
  assert.match(getGeolocationErrorMessage({ code: 3 }), /timed out/i);
  assert.match(getGeolocationErrorMessage({ code: 99 }), /current location/i);
  assert.doesNotMatch(
    getGeolocationErrorMessage({ code: 99, message: "private browser detail" }),
    /private browser detail/i
  );
});

test("camera browser errors map by safe error name without exposing details", () => {
  assert.match(getCameraErrorMessage({ name: "NotAllowedError" }), /denied/i);
  assert.match(getCameraErrorMessage({ name: "SecurityError" }), /denied/i);
  assert.match(getCameraErrorMessage({ name: "NotFoundError" }), /not found/i);
  assert.match(getCameraErrorMessage({ name: "OverconstrainedError" }), /not found/i);
  assert.match(getCameraErrorMessage({ name: "NotReadableError" }), /unavailable|in use/i);
  assert.match(getCameraErrorMessage({ name: "AbortError" }), /unavailable|in use/i);
  assert.match(getCameraErrorMessage({ name: "UnknownError" }), /camera/i);
  assert.doesNotMatch(
    getCameraErrorMessage({
      name: "UnknownError",
      message: "private device identifier",
    }),
    /private device identifier/i
  );
});

test("only a concise plain API message replaces the public fallback", () => {
  const fallback = "We could not verify this visit. Please try again.";

  assert.equal(
    selectSafeApiMessage(
      { message: "  You must be near the selected attraction.  " },
      fallback
    ),
    "You must be near the selected attraction."
  );
  assert.equal(selectSafeApiMessage(null, fallback), fallback);
  assert.equal(selectSafeApiMessage({ message: 500 }, fallback), fallback);
  assert.equal(selectSafeApiMessage({ message: "line one\nline two" }, fallback), fallback);
  assert.equal(selectSafeApiMessage({ message: "x".repeat(201) }, fallback), fallback);
});

test("verified visit multipart data contains only the canonical evidence fields", () => {
  const photoBlob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
  const formData = createVerifiedVisitFormData({
    photoBlob,
    attractionId: "attraction-1",
    position: { latitude: 2, longitude: 102, accuracyMeters: 20 },
  });

  assert.equal(formData.get("photo").name, "verified-visit.jpg");
  assert.equal(formData.get("photo").type, "image/jpeg");
  assert.equal(formData.get("attractionId"), "attraction-1");
  assert.equal(formData.get("latitude"), "2");
  assert.equal(formData.get("longitude"), "102");
  assert.equal(formData.get("accuracyMeters"), "20");
  assert.deepEqual(
    [...formData.keys()],
    ["photo", "attractionId", "latitude", "longitude", "accuracyMeters"]
  );
});

test("media cleanup attempts to stop every track even when one stop fails", () => {
  const stopped = [];
  const stream = {
    getTracks() {
      return [
        {
          stop() {
            stopped.push("first");
            throw new Error("device teardown detail");
          },
        },
        { stop: () => stopped.push("second") },
      ];
    },
  };

  assert.doesNotThrow(() => stopMediaStream(stream));
  assert.deepEqual(stopped, ["first", "second"]);
  assert.doesNotThrow(() => stopMediaStream(null));
});

test("object URL cleanup revokes only usable object URLs", () => {
  const revoked = [];
  const urlApi = { revokeObjectURL: (url) => revoked.push(url) };

  revokeObjectUrl("blob:verified-photo", urlApi);
  revokeObjectUrl("", urlApi);
  revokeObjectUrl(null, urlApi);

  assert.deepEqual(revoked, ["blob:verified-photo"]);
});
