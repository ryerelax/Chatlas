import assert from "node:assert/strict";
import test from "node:test";
import * as visitVerificationPresentation from "../src/presentation/lib/visitVerificationPresentation.js";
import {
  createVerifiedVisitFormData,
  getCameraErrorMessage,
  getCandidateSelectionMode,
  getGeolocationErrorMessage,
  getNearbyCandidatePresentations,
  getNoNearbyAttractionMessage,
  getVerificationAuthenticationState,
  normaliseBrowserPosition,
  requestCurrentBrowserPosition,
  revokeObjectUrl,
  selectSafeApiMessage,
  stopMediaStream,
} from "../src/presentation/lib/visitVerificationPresentation.js";

const METRES_PER_RADIAN = 6371000;
const DAILY_LIMIT_MESSAGE =
  "You have already verified this attraction today. You can add a new photo on another Malaysia date.";
const latitudeOffset = (metres) =>
  (metres / METRES_PER_RADIAN) * (180 / Math.PI);

function createOperationController(options) {
  assert.equal(
    typeof visitVerificationPresentation.createVisitVerificationOperationController,
    "function",
    "the lifecycle controller must be exported"
  );

  return visitVerificationPresentation.createVisitVerificationOperationController(
    options
  );
}

function approveCameraCapacity(controller, operationToken, remainingSlots = 1) {
  const capacityController = new AbortController();
  assert.equal(
    controller.claimCapacity(operationToken, capacityController),
    true
  );
  assert.equal(
    controller.completeCapacity(
      operationToken,
      capacityController,
      remainingSlots
    ),
    true
  );
}

function getAuthenticationTransition(flowState, authenticationState) {
  assert.equal(
    typeof visitVerificationPresentation.getVisitVerificationAuthenticationTransition,
    "function",
    "the authentication transition helper must be exported"
  );

  return visitVerificationPresentation.getVisitVerificationAuthenticationTransition(
    flowState,
    authenticationState
  );
}

function getResponseDecision(response, result, fallbackMessages) {
  assert.equal(
    typeof visitVerificationPresentation.getVisitVerificationResponseDecision,
    "function",
    "the response decision helper must be exported"
  );

  return visitVerificationPresentation.getVisitVerificationResponseDecision(
    response,
    result,
    fallbackMessages
  );
}

function createLifecycleResources() {
  const stopped = [];
  const revoked = [];
  const aborted = [];

  return {
    stopped,
    revoked,
    aborted,
    createStream(label) {
      return {
        getTracks() {
          return [{ stop: () => stopped.push(label) }];
        },
      };
    },
    createAbortController(label) {
      return { abort: () => aborted.push(label) };
    },
    stopStream: (stream) => stopMediaStream(stream),
    revokeUrl: (url) => revoked.push(url),
  };
}

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
      { coords: { latitude: 2, longitude: 102, accuracy: 30.1 } },
    ],
  ]) {
    await context.test(label, () => {
      assert.throws(() => normaliseBrowserPosition(position), /location|accuracy/i);
    });
  }
});

test("browser accuracy failure reports the measured value and exact 30-metre guidance", () => {
  assert.throws(
    () => normaliseBrowserPosition({
      coords: { latitude: 2, longitude: 102, accuracy: 30.1 },
    }),
    {
      message: "Location accuracy is currently 30.1 metres. Move outdoors and try again. Accuracy must be within 30 metres.",
    }
  );
});

test("browser location stays a one-shot fresh high-accuracy request with the existing timeout", () => {
  const calls = [];
  const success = () => {};
  const failure = () => {};
  const geolocation = {
    getCurrentPosition(...args) {
      calls.push(args);
    },
  };

  requestCurrentBrowserPosition(geolocation, success, failure);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], success);
  assert.equal(calls[0][1], failure);
  assert.deepEqual(calls[0][2], {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
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
    authenticationState: "confirmed",
    authenticationConfirmed: true,
    authenticationPending: false,
    authenticationRequired: false,
    authenticationUnavailable: false,
  });
  assert.deepEqual(getVerificationAuthenticationState("loading"), {
    authenticationState: "pending",
    authenticationConfirmed: false,
    authenticationPending: true,
    authenticationRequired: false,
    authenticationUnavailable: false,
  });
  assert.deepEqual(getVerificationAuthenticationState("auth-required"), {
    authenticationState: "required",
    authenticationConfirmed: false,
    authenticationPending: false,
    authenticationRequired: true,
    authenticationUnavailable: false,
  });

  for (const visitedDataStatus of ["error", "unavailable", "unknown"]) {
    assert.deepEqual(
      getVerificationAuthenticationState(visitedDataStatus),
      {
        authenticationState: "unavailable",
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
      authenticationState: "unavailable",
      authenticationConfirmed: false,
      authenticationPending: false,
      authenticationRequired: false,
      authenticationUnavailable: true,
    }
  );

  assert.deepEqual(
    getVerificationAuthenticationState("loading", {
      developmentPreviewActive: true,
    }),
    {
      authenticationState: "unavailable",
      authenticationConfirmed: false,
      authenticationPending: false,
      authenticationRequired: false,
      authenticationUnavailable: true,
    }
  );
});

test("authenticated map presentation enables Verify Nearby Visit without a sign-in prompt", () => {
  const authentication = getVerificationAuthenticationState("success");
  const transition = getAuthenticationTransition(
    "idle",
    authentication.authenticationState
  );
  const verificationButtonDisabled = authentication.authenticationPending;

  assert.equal(authentication.authenticationConfirmed, true);
  assert.equal(authentication.authenticationPending, false);
  assert.equal(transition.authenticationPromptVisible, false);
  assert.equal(verificationButtonDisabled, false);
});

test("success acknowledgement survives the canonical loading and success refresh", () => {
  const whileRefreshing = getAuthenticationTransition("success", "pending");
  assert.deepEqual(whileRefreshing, {
    nextFlowState: "success",
    resetFlowData: false,
    authenticationPromptVisible: false,
    authenticationUnavailableVisible: false,
  });

  assert.deepEqual(
    getAuthenticationTransition(
      whileRefreshing.nextFlowState,
      "confirmed"
    ),
    {
      nextFlowState: "success",
      resetFlowData: false,
      authenticationPromptVisible: false,
      authenticationUnavailableVisible: false,
    }
  );
});

test("authentication loss resets active states to a blocked idle presentation", () => {
  assert.deepEqual(getAuthenticationTransition("locating", "pending"), {
    nextFlowState: "idle",
    resetFlowData: true,
    authenticationPromptVisible: false,
    authenticationUnavailableVisible: false,
  });
  assert.deepEqual(getAuthenticationTransition("submitting", "required"), {
    nextFlowState: "idle",
    resetFlowData: true,
    authenticationPromptVisible: true,
    authenticationUnavailableVisible: false,
  });
  assert.deepEqual(getAuthenticationTransition("preview", "unavailable"), {
    nextFlowState: "idle",
    resetFlowData: true,
    authenticationPromptVisible: false,
    authenticationUnavailableVisible: true,
  });
});

test("a 401 response requires authentication and blocks new operations until real auth returns", () => {
  const controller = createOperationController({
    authenticationConfirmed: true,
  });
  const activeToken = controller.claimLocation();
  const decision = getResponseDecision(
    { ok: false, status: 401 },
    { message: "Sign in again to continue." },
    {
      authentication: "Your session has expired.",
      verification: "Verification failed.",
    }
  );

  assert.deepEqual(decision, {
    type: "authentication-required",
    message: "Sign in again to continue.",
    authenticationRequired: true,
    retryable: false,
  });

  controller.updateAuthentication(!decision.authenticationRequired);
  assert.equal(controller.isCurrent(activeToken), false);
  assert.equal(controller.restartOperation("retry"), null);
  assert.equal(controller.claimLocation(), null);

  controller.updateAuthentication(true);
  assert.equal(typeof controller.claimLocation(), "number");
});

test("response decisions separate terminal 4xx failures from ambiguous 5xx retry outcomes", () => {
  const fallbackMessages = {
    authentication: "Your session has expired.",
    verification: "Verification failed.",
  };

  assert.deepEqual(
    getResponseDecision(
      { ok: false, status: 409 },
      { message: "This visit already has enough photos." },
      fallbackMessages
    ),
    {
      type: "terminal-error",
      message: DAILY_LIMIT_MESSAGE,
      authenticationRequired: false,
      retryable: false,
    }
  );
  assert.deepEqual(
    getResponseDecision(
      { ok: false, status: 400 },
      { message: "The live evidence is no longer valid." },
      fallbackMessages
    ),
    {
      type: "terminal-error",
      message: "The live evidence is no longer valid.",
      authenticationRequired: false,
      retryable: false,
    }
  );
  assert.deepEqual(
    getResponseDecision(
      { ok: false, status: 500 },
      { message: "internal\u0000detail" },
      fallbackMessages
    ),
    {
      type: "retryable-error",
      message: "Verification failed.",
      authenticationRequired: false,
      retryable: true,
    }
  );
  assert.deepEqual(
    getResponseDecision(
      { ok: false, status: 401 },
      { message: "internal\u0000detail" },
      fallbackMessages
    ),
    {
      type: "authentication-required",
      message: "Your session has expired.",
      authenticationRequired: true,
      retryable: false,
    }
  );
  assert.deepEqual(
    getResponseDecision(
      { ok: true, status: 201 },
      { message: "ignored" },
      fallbackMessages
    ),
    {
      type: "success",
      message: "",
      authenticationRequired: false,
      retryable: false,
    }
  );
});

test("ambiguous upload failure retains retry evidence while a definitive 4xx reset revokes it", () => {
  for (const [status, expectedRetryable] of [[500, true], [409, false]]) {
    const resources = createLifecycleResources();
    const controller = createOperationController({
      authenticationConfirmed: true,
      stopStream: resources.stopStream,
      revokeUrl: resources.revokeUrl,
    });
    const operationToken = controller.claimLocation();
    const submitController = resources.createAbortController(`submit-${status}`);
    const selectedCapture = {
      blob: new Blob([`selected-${status}`]),
      url: `blob:selected-${status}`,
    };

    controller.completeLocation(operationToken);
    approveCameraCapacity(controller, operationToken);
    controller.claimCamera(operationToken);
    controller.resolveCamera(
      operationToken,
      resources.createStream(`camera-${status}`)
    );
    controller.setCurrentCapture(operationToken, selectedCapture);
    controller.claimSubmission(operationToken, submitController, {
      capturePending: false,
    });

    const decision = getResponseDecision(
      { ok: false, status },
      { message: status === 409 ? "untrusted capacity wording" : "Try again." },
      {
        authentication: "Sign in again.",
        verification: "Verification failed.",
      }
    );
    assert.equal(decision.retryable, expectedRetryable);
    assert.equal(
      controller.completeSubmission(operationToken, submitController),
      true
    );

    if (!decision.retryable) {
      controller.invalidate("terminal-response");
    }

    assert.deepEqual(
      controller.getCaptureState(),
      { currentCapture: expectedRetryable ? selectedCapture : null }
    );
    assert.deepEqual(
      resources.revoked,
      expectedRetryable ? [] : [`blob:selected-${status}`]
    );
    assert.equal(controller.isCurrent(operationToken), expectedRetryable);
  }
});

test("authentication loss invalidates the operation and tears down every resource", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const stream = resources.createStream("active-camera");
  const abortController = resources.createAbortController("active-submit");

  assert.equal(controller.completeLocation(operationToken), true);
  approveCameraCapacity(controller, operationToken);
  assert.equal(controller.claimCamera(operationToken), true);
  assert.equal(controller.resolveCamera(operationToken, stream), true);
  assert.equal(controller.setCurrentCapture(operationToken, {
    blob: new Blob(["active-preview"]),
    url: "blob:active-preview",
  }), true);
  assert.equal(
    controller.claimSubmission(operationToken, abortController, {
      capturePending: false,
    }),
    true
  );
  assert.deepEqual(controller.updateAuthentication(false), {
    authenticationConfirmed: false,
    operationInvalidated: true,
  });
  assert.equal(controller.isCurrent(operationToken), false);
  assert.deepEqual(resources.stopped, ["active-camera"]);
  assert.deepEqual(resources.revoked, ["blob:active-preview"]);
  assert.deepEqual(resources.aborted, ["active-submit"]);

  const staleStream = resources.createStream("stale-camera");
  assert.equal(
    controller.resolveCamera(operationToken, staleStream),
    false
  );
  assert.deepEqual(resources.stopped, ["active-camera", "stale-camera"]);
});

test("operation claims synchronously reject duplicate location, camera, and submission work", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();

  assert.equal(typeof operationToken, "number");
  assert.equal(controller.claimLocation(), null);
  assert.equal(controller.completeLocation(operationToken), true);
  approveCameraCapacity(controller, operationToken);
  assert.equal(controller.claimCamera(operationToken), true);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(
    controller.resolveCamera(
      operationToken,
      resources.createStream("camera")
    ),
    true
  );
  controller.setCurrentCapture(operationToken, {
    blob: new Blob(["selected-photo"]),
    url: "blob:selected-photo",
  });

  const firstSubmit = resources.createAbortController("first-submit");
  const duplicateSubmit = resources.createAbortController("duplicate-submit");
  assert.equal(
    controller.claimSubmission(operationToken, firstSubmit, {
      capturePending: false,
    }),
    true
  );
  assert.equal(
    controller.claimSubmission(operationToken, duplicateSubmit, {
      capturePending: false,
    }),
    false
  );
  assert.deepEqual(resources.aborted, []);
});

test("camera ownership ends synchronously when the active stream is released", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const stream = resources.createStream("owned-camera");
  controller.completeLocation(operationToken);
  approveCameraCapacity(controller, operationToken);
  controller.claimCamera(operationToken);
  controller.resolveCamera(operationToken, stream);

  assert.equal(typeof controller.isActiveStream, "function");
  assert.equal(controller.isActiveStream(stream), true);
  controller.releaseStream();
  assert.equal(controller.isActiveStream(stream), false);
  assert.deepEqual(resources.stopped, ["owned-camera"]);
});

test("stale camera and preview callbacks are denied and their resources are released", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  controller.invalidate("close");

  assert.equal(controller.completeLocation(operationToken), false);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(
    controller.resolveCamera(
      operationToken,
      resources.createStream("late-camera")
    ),
    false
  );
  assert.equal(
    controller.setPreview(operationToken, "blob:late-preview"),
    false
  );
  assert.deepEqual(resources.stopped, ["late-camera"]);
  assert.deepEqual(resources.revoked, ["blob:late-preview"]);
});

test("close, error, and unmount invalidate work and clean active resources", async (context) => {
  for (const action of ["close", "error", "unmount"]) {
    await context.test(action, () => {
      const resources = createLifecycleResources();
      const controller = createOperationController({
        authenticationConfirmed: true,
        stopStream: resources.stopStream,
        revokeUrl: resources.revokeUrl,
      });
      const operationToken = controller.claimLocation();
      controller.completeLocation(operationToken);
      approveCameraCapacity(controller, operationToken);
      controller.claimCamera(operationToken);
      controller.resolveCamera(
        operationToken,
        resources.createStream(`${action}-camera`)
      );
      controller.setCurrentCapture(operationToken, {
        blob: new Blob([`${action}-preview`]),
        url: `blob:${action}-preview`,
      });
      controller.claimSubmission(
        operationToken,
        resources.createAbortController(`${action}-submit`),
        { capturePending: false }
      );

      controller.invalidate(action);

      assert.equal(controller.isCurrent(operationToken), false);
      assert.deepEqual(resources.stopped, [`${action}-camera`]);
      assert.deepEqual(resources.revoked, [`blob:${action}-preview`]);
      assert.deepEqual(resources.aborted, [`${action}-submit`]);
    });
  }
});

test("a full operation restart releases the old camera and preview before a new claim", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const oldToken = controller.claimLocation();
  controller.completeLocation(oldToken);
  approveCameraCapacity(controller, oldToken);
  controller.claimCamera(oldToken);
  controller.resolveCamera(oldToken, resources.createStream("old-camera"));
  controller.setPreview(oldToken, "blob:old-preview");

  const newToken = controller.restartOperation("reset");

  assert.notEqual(newToken, oldToken);
  assert.equal(controller.isCurrent(oldToken), false);
  assert.equal(controller.isCurrent(newToken), true);
  approveCameraCapacity(controller, newToken);
  assert.equal(controller.claimCamera(newToken), true);
  assert.equal(controller.restartOperation("duplicate-reset"), null);
  assert.deepEqual(resources.stopped, ["old-camera"]);
  assert.deepEqual(resources.revoked, ["blob:old-preview"]);
});

test("success cleans media and preview without aborting a completed submission", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const abortController = resources.createAbortController("completed-submit");
  controller.completeLocation(operationToken);
  approveCameraCapacity(controller, operationToken);
  controller.claimCamera(operationToken);
  controller.resolveCamera(
    operationToken,
    resources.createStream("success-camera")
  );
  controller.setCurrentCapture(operationToken, {
    blob: new Blob(["success-preview"]),
    url: "blob:success-preview",
  });
  controller.claimSubmission(operationToken, abortController, {
    capturePending: false,
  });

  assert.equal(
    controller.completeSubmission(operationToken, abortController),
    true
  );
  controller.invalidate("success");

  assert.deepEqual(resources.stopped, ["success-camera"]);
  assert.deepEqual(resources.revoked, ["blob:success-preview"]);
  assert.deepEqual(resources.aborted, []);
});

test("nearby candidate presentations stay distance-sorted with distance and radius labels", () => {
  const candidates = getNearbyCandidatePresentations(
    [
      {
        id: "one-hundred-metres",
        name: "Riverside Museum",
        category: "Nature",
        latitude: 2 + latitudeOffset(100),
        longitude: 102,
      },
      {
        id: "same-place",
        name: "Town Square",
        category: "Gallery",
        latitude: 2,
        longitude: 102,
      },
      {
        id: "outside-radius",
        name: "Hill View",
        category: "Gallery",
        latitude: 2 + latitudeOffset(50.1),
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
      { id: "same-place", distanceLabel: "0 m away · 50 m verification radius" },
      { id: "one-hundred-metres", distanceLabel: "100 m away · 100 m verification radius" },
    ]
  );
  assert.equal(candidates[0].distanceMetres, 0);
  assert.ok(candidates[1].distanceMetres >= 99.99);
  assert.ok(candidates[1].distanceMetres <= 100.01);
});

test("zero candidates explain the nearest-to-qualifying distance and allowed radius", () => {
  const message = getNoNearbyAttractionMessage([
    {
      id: "gallery",
      name: "Gallery Place",
      category: "Gallery",
      latitude: 2 + latitudeOffset(60),
      longitude: 102,
    },
    {
      id: "nature",
      name: "Nature Place",
      category: "Nature",
      latitude: 2 + latitudeOffset(105),
      longitude: 102,
    },
  ], { latitude: 2, longitude: 102, accuracyMeters: 20 });

  assert.equal(
    message,
    "No supported attraction is close enough. Nature Place is 105 metres away (allowed radius: 100 metres)."
  );
});

test("no-nearby copy preserves a just-outside decimal distance", () => {
  const message = getNoNearbyAttractionMessage([
    {
      id: "gallery-boundary",
      name: "Boundary Gallery",
      category: "Gallery",
      latitude: 2 + latitudeOffset(50.1),
      longitude: 102,
    },
  ], { latitude: 2, longitude: 102, accuracyMeters: 20 });

  assert.equal(
    message,
    "No supported attraction is close enough. Boundary Gallery is 50.1 metres away (allowed radius: 50 metres)."
  );
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

test("verified visit multipart data contains one photo and no client identity or radius", () => {
  const photoBlob = new Blob(["jpeg"], { type: "image/jpeg" });
  const formData = createVerifiedVisitFormData({
    photoBlob,
    attractionId: "attraction-1",
    position: { latitude: 2, longitude: 102, accuracyMeters: 20 },
  });

  assert.equal(formData.get("photo").name, "verified-visit.jpg");
  assert.equal(formData.get("photo").type, "image/jpeg");
  assert.equal(formData.has("photos"), false);
  assert.equal(formData.get("attractionId"), "attraction-1");
  assert.equal(formData.get("latitude"), "2");
  assert.equal(formData.get("longitude"), "102");
  assert.equal(formData.get("accuracyMeters"), "20");
  assert.deepEqual(
    [...formData.keys()],
    [
      "photo",
      "attractionId",
      "latitude",
      "longitude",
      "accuracyMeters",
    ]
  );
  assert.equal(formData.has("userId"), false);
  assert.equal(formData.has("googleId"), false);
  assert.equal(formData.has("verificationRadiusMeters"), false);
});

test("capacity accepts the one-photo limit and closes legacy positive counts", () => {
  assert.equal(
    typeof visitVerificationPresentation.normaliseVerifiedVisitCapacity,
    "function"
  );

  for (const existingTodayCount of [0, 1, 2, 3]) {
    const remainingSlots = existingTodayCount === 0 ? 1 : 0;
    assert.deepEqual(
      visitVerificationPresentation.normaliseVerifiedVisitCapacity(
        {
          success: true,
          data: {
            attractionId: "attraction-1",
            dailyLimit: 1,
            existingTodayCount,
            remainingSlots,
          },
        },
        "attraction-1"
      ),
      {
        attractionId: "attraction-1",
        dailyLimit: 1,
        existingTodayCount,
        remainingSlots,
      }
    );
  }

  assert.throws(
    () => visitVerificationPresentation.normaliseVerifiedVisitCapacity(
      {
        success: true,
        data: {
          attractionId: "another-attraction",
          dailyLimit: 1,
          existingTodayCount: 0,
          remainingSlots: 1,
        },
      },
      "attraction-1"
    ),
    /capacity/i
  );
});

test("capacity is claimed once and zero slots never permit a camera claim", () => {
  const controller = createOperationController({ authenticationConfirmed: true });
  const operationToken = controller.claimLocation();
  const capacityRequest = new AbortController();

  assert.equal(controller.completeLocation(operationToken), true);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(controller.claimCapacity(operationToken, capacityRequest), true);
  assert.equal(controller.claimCapacity(operationToken, new AbortController()), false);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(
    controller.completeCapacity(operationToken, capacityRequest, 0),
    true
  );
  assert.equal(controller.claimCamera(operationToken), false);
});

test("the full-capacity message directs the user to another Malaysia date", () => {
  assert.equal(
    visitVerificationPresentation.getVerifiedVisitLimitReachedMessage(),
    "You have already verified this attraction today. You can add a new photo on another Malaysia date."
  );
});

test("cancelling during capacity preflight aborts the request before any camera claim", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({ authenticationConfirmed: true });
  const operationToken = controller.claimLocation();
  const capacityRequest = resources.createAbortController("active-capacity");

  controller.completeLocation(operationToken);
  assert.equal(controller.claimCapacity(operationToken, capacityRequest), true);
  controller.invalidate("cancel");

  assert.deepEqual(resources.aborted, ["active-capacity"]);
  assert.equal(controller.isCurrent(operationToken), false);
});

test("one available slot permits only one live camera stream", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const capacityRequest = resources.createAbortController("capacity");

  controller.completeLocation(operationToken);
  assert.equal(controller.claimCapacity(operationToken, capacityRequest), true);
  assert.equal(
    controller.completeCapacity(operationToken, capacityRequest, 1),
    true
  );
  assert.equal(controller.claimCamera(operationToken), true);
  assert.equal(controller.claimCamera(operationToken), false);

  const stream = resources.createStream("camera");
  assert.equal(controller.resolveCamera(operationToken, stream), true);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(controller.isActiveStream(stream), true);
  assert.deepEqual(resources.stopped, []);
});

test("Retake revokes only the current capture and keeps the same stream active", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const capacityRequest = resources.createAbortController("capacity");
  const stream = resources.createStream("continuous-camera");

  controller.completeLocation(operationToken);
  controller.claimCapacity(operationToken, capacityRequest);
  controller.completeCapacity(operationToken, capacityRequest, 1);
  controller.claimCamera(operationToken);
  controller.resolveCamera(operationToken, stream);
  assert.equal(
    controller.setCurrentCapture(operationToken, {
      blob: new Blob(["first"]),
      url: "blob:current",
    }),
    true
  );

  assert.equal(controller.retakeCurrentCapture(operationToken), true);
  assert.deepEqual(controller.getCaptureState(), {
    currentCapture: null,
  });
  assert.equal(controller.isActiveStream(stream), true);
  assert.deepEqual(resources.stopped, []);
  assert.deepEqual(resources.revoked, ["blob:current"]);
});

test("the controller owns one current capture and replacing it revokes the old preview", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();

  controller.completeLocation(operationToken);
  const secondCapture = {
    blob: new Blob(["second"]),
    url: "blob:second",
  };
  controller.setCurrentCapture(operationToken, {
    blob: new Blob(["first"]),
    url: "blob:first",
  });
  controller.setCurrentCapture(operationToken, secondCapture);

  assert.deepEqual(controller.getCaptureState(), {
    currentCapture: secondCapture,
  });
  assert.deepEqual(resources.revoked, ["blob:first"]);
});

test("the single-photo upload label is exact", () => {
  assert.equal(
    typeof visitVerificationPresentation.getVerifiedVisitUploadLabel,
    "function"
  );
  assert.equal(
    visitVerificationPresentation.getVerifiedVisitUploadLabel(),
    "Upload Photo"
  );
});

test("submission requires one completed preview and an explicit non-pending capture", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const submitController = resources.createAbortController("submit");

  controller.completeLocation(operationToken);
  approveCameraCapacity(controller, operationToken);
  controller.claimCamera(operationToken);
  controller.resolveCamera(
    operationToken,
    resources.createStream("upload-camera")
  );

  assert.equal(
    controller.claimSubmission(operationToken, submitController, {
      capturePending: false,
    }),
    false,
    "a submission without a preview must be rejected"
  );
  const selectedCapture = {
    blob: new Blob(["selected"]),
    url: "blob:selected",
  };
  controller.setCurrentCapture(operationToken, selectedCapture);
  assert.equal(
    controller.claimSubmission(operationToken, submitController, {
      capturePending: true,
    }),
    false,
    "a canvas callback still in flight must block upload"
  );
  assert.deepEqual(resources.stopped, []);
  assert.equal(
    controller.claimSubmission(operationToken, submitController, {
      capturePending: false,
    }),
    true
  );
  assert.deepEqual(controller.getCaptureState(), {
    currentCapture: selectedCapture,
  });
  assert.deepEqual(resources.stopped, ["upload-camera"]);
});

test("upload eligibility requires the selected preview and blocks a pending capture", () => {
  assert.equal(
    typeof visitVerificationPresentation.canSubmitVerifiedVisitPhoto,
    "function"
  );
  const currentCapture = {
    blob: new Blob(["photo"]),
    url: "blob:photo",
  };
  const submissionInput = {
    flowState: "preview",
    currentCapture,
    capturePending: false,
    position: { latitude: 2, longitude: 102, accuracyMeters: 20 },
    attractionId: "attraction-1",
  };
  assert.equal(
    visitVerificationPresentation.canSubmitVerifiedVisitPhoto({
      ...submissionInput,
      capturePending: true,
    }),
    false
  );
  assert.equal(
    visitVerificationPresentation.canSubmitVerifiedVisitPhoto({
      ...submissionInput,
      currentCapture: null,
    }),
    false
  );
  assert.equal(
    visitVerificationPresentation.canSubmitVerifiedVisitPhoto(submissionInput),
    true
  );
});

test("upload eligibility fails closed unless capturePending is explicitly false", () => {
  const currentCapture = {
    blob: new Blob(["photo"]),
    url: "blob:photo",
  };
  const submissionInput = {
    flowState: "preview",
    currentCapture,
    position: { latitude: 2, longitude: 102, accuracyMeters: 20 },
    attractionId: "attraction-1",
  };

  for (const capturePending of [undefined, null, "false", 0]) {
    assert.equal(
      visitVerificationPresentation.canSubmitVerifiedVisitPhoto({
        ...submissionInput,
        capturePending,
      }),
      false,
      `capturePending ${String(capturePending)} must fail closed`
    );
  }
  assert.equal(
    visitVerificationPresentation.canSubmitVerifiedVisitPhoto(submissionInput),
    false,
    "an omitted capturePending state must fail closed"
  );
  assert.equal(
    visitVerificationPresentation.canSubmitVerifiedVisitPhoto({
      ...submissionInput,
      capturePending: false,
    }),
    true
  );
});

test("retryable submission completion preserves the selected capture and blocks duplicate submits", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const firstSubmit = resources.createAbortController("first-submit");
  const duplicateSubmit = resources.createAbortController("duplicate-submit");
  const selectedCapture = {
    blob: new Blob(["selected"]),
    url: "blob:selected",
  };

  controller.completeLocation(operationToken);
  approveCameraCapacity(controller, operationToken);
  controller.claimCamera(operationToken);
  controller.resolveCamera(
    operationToken,
    resources.createStream("upload-camera")
  );
  controller.setCurrentCapture(operationToken, selectedCapture);
  assert.equal(
    controller.claimSubmission(operationToken, firstSubmit, {
      capturePending: false,
    }),
    true
  );
  assert.equal(
    controller.claimSubmission(operationToken, duplicateSubmit, {
      capturePending: false,
    }),
    false
  );
  assert.equal(
    controller.completeSubmission(operationToken, firstSubmit),
    true
  );
  assert.deepEqual(controller.getCaptureState(), {
    currentCapture: selectedCapture,
  });
  assert.deepEqual(resources.stopped, ["upload-camera"]);
  assert.deepEqual(resources.revoked, []);
  assert.equal(
    controller.claimSubmission(
      operationToken,
      resources.createAbortController("retry-submit"),
      { capturePending: false }
    ),
    true
  );
});

test("a post-claim valid capture is rejected and its preview URL is revoked", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const operationToken = controller.claimLocation();
  const submitController = resources.createAbortController("active-submit");
  const selectedCapture = {
    blob: new Blob(["selected"]),
    url: "blob:selected",
  };

  controller.completeLocation(operationToken);
  approveCameraCapacity(controller, operationToken);
  controller.setCurrentCapture(operationToken, selectedCapture);
  assert.equal(
    controller.claimSubmission(operationToken, submitController, {
      capturePending: false,
    }),
    true
  );

  assert.equal(
    controller.setCurrentCapture(operationToken, {
      blob: new Blob(["late"]),
      url: "blob:late-canvas-result",
    }),
    false
  );
  assert.deepEqual(controller.getCaptureState(), {
    currentCapture: selectedCapture,
  });
  assert.deepEqual(resources.revoked, ["blob:late-canvas-result"]);
  assert.deepEqual(resources.aborted, []);
});

test("post-claim null and object-URL failures settle without failing or changing the selected photo", () => {
  assert.equal(
    typeof visitVerificationPresentation.completeVerifiedVisitCanvasCapture,
    "function"
  );

  for (const resultKind of ["null-blob", "object-url-error"]) {
    const resources = createLifecycleResources();
    const controller = createOperationController({
      authenticationConfirmed: true,
      stopStream: resources.stopStream,
      revokeUrl: resources.revokeUrl,
    });
    const operationToken = controller.claimLocation();
    const selectedCapture = {
      blob: new Blob(["selected"]),
      url: `blob:selected-${resultKind}`,
    };
    const failures = [];
    let settled = 0;

    controller.completeLocation(operationToken);
    approveCameraCapacity(controller, operationToken);
    controller.setCurrentCapture(operationToken, selectedCapture);

    if (resultKind === "null-blob") {
      const submitController = resources.createAbortController("null-submit");
      controller.claimSubmission(operationToken, submitController, {
        capturePending: false,
      });
      controller.completeSubmission(operationToken, submitController);
    }

    const completed = visitVerificationPresentation.completeVerifiedVisitCanvasCapture({
      operationController: controller,
      operationToken,
      blob: resultKind === "null-blob" ? null : new Blob(["late"]),
      createObjectUrl: () => {
        const submitController = resources.createAbortController("url-submit");
        controller.claimSubmission(operationToken, submitController, {
          capturePending: false,
        });
        controller.completeSubmission(operationToken, submitController);
        throw new Error("object URL unavailable");
      },
      onAccepted: () => assert.fail("a claimed submission cannot accept a capture"),
      onFailure: (message) => failures.push(message),
      onSettled: () => {
        settled += 1;
      },
    });

    assert.equal(completed, false, resultKind);
    assert.equal(settled, 1, resultKind);
    assert.deepEqual(failures, [], resultKind);
    assert.deepEqual(controller.getCaptureState(), {
      currentCapture: selectedCapture,
    }, resultKind);
    assert.deepEqual(resources.aborted, [], resultKind);
  }
});

test("one cryptographically strong submission key is reused until terminal reset", () => {
  assert.equal(
    typeof visitVerificationPresentation.createVerifiedVisitSubmissionKeyStore,
    "function"
  );
  const generatedKeys = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  let generationCount = 0;
  const keyStore =
    visitVerificationPresentation.createVerifiedVisitSubmissionKeyStore({
      crypto: {
        randomUUID() {
          return generatedKeys[generationCount++];
        },
      },
    });

  const firstAttemptKey = keyStore.getOrCreate();
  const retryKey = keyStore.getOrCreate();
  assert.equal(firstAttemptKey, generatedKeys[0]);
  assert.equal(retryKey, firstAttemptKey);
  assert.equal(generationCount, 1);

  const retryFormData = createVerifiedVisitFormData({
    photoBlob: new Blob(["photo"], { type: "image/jpeg" }),
    attractionId: "attraction-1",
    position: { latitude: 2, longitude: 102, accuracyMeters: 20 },
    submissionKey: retryKey,
  });
  assert.equal(retryFormData.get("submissionKey"), firstAttemptKey);
  assert.equal(retryFormData.has("userId"), false);
  assert.equal(retryFormData.has("googleId"), false);
  assert.equal(retryFormData.has("verificationRadiusMeters"), false);

  keyStore.reset();
  assert.equal(keyStore.getOrCreate(), generatedKeys[1]);
  assert.equal(generationCount, 2);
});

test("cancel, auth loss, success, reset errors, and unmount clean the single-photo resources", async (context) => {
  for (const action of ["cancel", "auth-loss", "success", "error", "unmount"]) {
    await context.test(action, () => {
      const resources = createLifecycleResources();
      const controller = createOperationController({
        authenticationConfirmed: true,
        stopStream: resources.stopStream,
        revokeUrl: resources.revokeUrl,
      });
      const operationToken = controller.claimLocation();
      const capacityRequest = resources.createAbortController(`${action}-capacity`);

      controller.completeLocation(operationToken);
      controller.claimCapacity(operationToken, capacityRequest);
      controller.completeCapacity(operationToken, capacityRequest, 1);
      controller.claimCamera(operationToken);
      controller.resolveCamera(
        operationToken,
        resources.createStream(`${action}-camera`)
      );
      controller.setCurrentCapture(operationToken, {
        blob: new Blob(["selected"]),
        url: `blob:${action}-selected`,
      });

      if (action === "auth-loss") controller.updateAuthentication(false);
      else controller.invalidate(action);

      assert.equal(controller.isCurrent(operationToken), false);
      assert.deepEqual(resources.stopped, [`${action}-camera`]);
      assert.deepEqual(resources.revoked, [`blob:${action}-selected`]);
      assert.deepEqual(controller.getCaptureState(), {
        currentCapture: null,
      });
    });
  }
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
