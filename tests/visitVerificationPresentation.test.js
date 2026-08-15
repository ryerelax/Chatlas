import assert from "node:assert/strict";
import test from "node:test";
import * as visitVerificationPresentation from "../src/presentation/lib/visitVerificationPresentation.js";
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
  });

  controller.updateAuthentication(!decision.authenticationRequired);
  assert.equal(controller.isCurrent(activeToken), false);
  assert.equal(controller.restartOperation("retry"), null);
  assert.equal(controller.claimLocation(), null);

  controller.updateAuthentication(true);
  assert.equal(typeof controller.claimLocation(), "number");
});

test("response decisions keep non-401 failures ordinary and preserve safe-message rules", () => {
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
      type: "error",
      message: "This visit already has enough photos.",
      authenticationRequired: false,
    }
  );
  assert.deepEqual(
    getResponseDecision(
      { ok: false, status: 500 },
      { message: "internal\u0000detail" },
      fallbackMessages
    ),
    {
      type: "error",
      message: "Verification failed.",
      authenticationRequired: false,
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
    }
  );
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
  assert.equal(controller.claimCamera(operationToken), true);
  assert.equal(controller.resolveCamera(operationToken, stream), true);
  assert.equal(controller.setPreview(operationToken, "blob:active-preview"), true);
  assert.equal(
    controller.claimSubmission(operationToken, abortController),
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
  assert.equal(controller.claimCamera(operationToken), true);
  assert.equal(controller.claimCamera(operationToken), false);
  assert.equal(
    controller.resolveCamera(
      operationToken,
      resources.createStream("camera")
    ),
    true
  );

  const firstSubmit = resources.createAbortController("first-submit");
  const duplicateSubmit = resources.createAbortController("duplicate-submit");
  assert.equal(
    controller.claimSubmission(operationToken, firstSubmit),
    true
  );
  assert.equal(
    controller.claimSubmission(operationToken, duplicateSubmit),
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
      controller.claimCamera(operationToken);
      controller.resolveCamera(
        operationToken,
        resources.createStream(`${action}-camera`)
      );
      controller.setPreview(operationToken, `blob:${action}-preview`);
      controller.claimSubmission(
        operationToken,
        resources.createAbortController(`${action}-submit`)
      );

      controller.invalidate(action);

      assert.equal(controller.isCurrent(operationToken), false);
      assert.deepEqual(resources.stopped, [`${action}-camera`]);
      assert.deepEqual(resources.revoked, [`blob:${action}-preview`]);
      assert.deepEqual(resources.aborted, [`${action}-submit`]);
    });
  }
});

test("retake releases the old camera and preview before allowing a new camera claim", () => {
  const resources = createLifecycleResources();
  const controller = createOperationController({
    authenticationConfirmed: true,
    stopStream: resources.stopStream,
    revokeUrl: resources.revokeUrl,
  });
  const oldToken = controller.claimLocation();
  controller.completeLocation(oldToken);
  controller.claimCamera(oldToken);
  controller.resolveCamera(oldToken, resources.createStream("old-camera"));
  controller.setPreview(oldToken, "blob:old-preview");

  const newToken = controller.restartOperation("retake");

  assert.notEqual(newToken, oldToken);
  assert.equal(controller.isCurrent(oldToken), false);
  assert.equal(controller.isCurrent(newToken), true);
  assert.equal(controller.claimCamera(newToken), true);
  assert.equal(controller.restartOperation("duplicate-retake"), null);
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
  controller.claimCamera(operationToken);
  controller.resolveCamera(
    operationToken,
    resources.createStream("success-camera")
  );
  controller.setPreview(operationToken, "blob:success-preview");
  controller.claimSubmission(operationToken, abortController);

  assert.equal(
    controller.completeSubmission(operationToken, abortController),
    true
  );
  controller.invalidate("success");

  assert.deepEqual(resources.stopped, ["success-camera"]);
  assert.deepEqual(resources.revoked, ["blob:success-preview"]);
  assert.deepEqual(resources.aborted, []);
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
