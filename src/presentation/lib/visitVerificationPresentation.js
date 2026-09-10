import {
  findNearestToQualifyingAttraction,
  findNearbyAttractions,
  normaliseVerifiedVisitSubmissionKey,
  validateGeolocationEvidence,
} from "@/business/services/visitVerificationRules";
import { VISITED_DATA_STATUS } from "@/business/services/explorationMapService";

const MAX_PUBLIC_API_MESSAGE_LENGTH = 200;
const VERIFIED_VISIT_DAILY_LIMIT = 1;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;
const CAPACITY_ERROR_MESSAGE =
  "Verified visit photo capacity could not be loaded.";
const VERIFIED_VISIT_LIMIT_REACHED_MESSAGE =
  "You have already verified this attraction today. You can add a new photo on another Malaysia date.";
const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
});
const DISTANCE_DISPLAY_TOLERANCE_METRES = 0.0000001;

function rejectEmptyBrowserNumber(value) {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim().length === 0)
  ) {
    return Number.NaN;
  }

  return value;
}

export function normaliseBrowserPosition(position) {
  return validateGeolocationEvidence({
    latitude: rejectEmptyBrowserNumber(position?.coords?.latitude),
    longitude: rejectEmptyBrowserNumber(position?.coords?.longitude),
    accuracyMeters: rejectEmptyBrowserNumber(position?.coords?.accuracy),
  });
}

export function requestCurrentBrowserPosition(geolocation, onSuccess, onError) {
  geolocation.getCurrentPosition(onSuccess, onError, GEOLOCATION_OPTIONS);
}

export function getCandidateSelectionMode(candidates) {
  const candidateCount = Array.isArray(candidates) ? candidates.length : 0;

  if (candidateCount === 0) {
    return "none";
  }

  return candidateCount === 1 ? "automatic" : "choose";
}

export function getVerificationAuthenticationState(
  visitedDataStatus,
  { developmentPreviewActive = false } = {}
) {
  if (developmentPreviewActive) {
    return {
      authenticationState: "unavailable",
      authenticationConfirmed: false,
      authenticationPending: false,
      authenticationRequired: false,
      authenticationUnavailable: true,
    };
  }

  const authenticationConfirmed =
    visitedDataStatus === VISITED_DATA_STATUS.SUCCESS;
  const authenticationPending =
    visitedDataStatus === VISITED_DATA_STATUS.LOADING;
  const authenticationRequired =
    visitedDataStatus === VISITED_DATA_STATUS.AUTH_REQUIRED;
  const authenticationUnavailable =
    !authenticationConfirmed &&
    !authenticationPending &&
    !authenticationRequired;
  const authenticationState = authenticationConfirmed
    ? "confirmed"
    : authenticationPending
      ? "pending"
      : authenticationRequired
        ? "required"
        : "unavailable";

  return {
    authenticationState,
    authenticationConfirmed,
    authenticationPending,
    authenticationRequired,
    authenticationUnavailable,
  };
}

export function getVisitVerificationAuthenticationTransition(
  flowState,
  authenticationState
) {
  const effectiveAuthenticationState = [
    "confirmed",
    "pending",
    "required",
    "unavailable",
  ].includes(authenticationState)
    ? authenticationState
    : "unavailable";
  const preserveSuccess =
    flowState === "success" && effectiveAuthenticationState === "pending";

  if (effectiveAuthenticationState === "confirmed" || preserveSuccess) {
    return {
      nextFlowState: flowState,
      resetFlowData: false,
      authenticationPromptVisible: false,
      authenticationUnavailableVisible: false,
    };
  }

  return {
    nextFlowState: "idle",
    resetFlowData: flowState !== "idle",
    authenticationPromptVisible:
      effectiveAuthenticationState === "required",
    authenticationUnavailableVisible:
      effectiveAuthenticationState === "unavailable",
  };
}

export function getVisitVerificationResponseDecision(
  response,
  result,
  fallbackMessages = {}
) {
  if (response?.ok === true) {
    return {
      type: "success",
      message: "",
      authenticationRequired: false,
      retryable: false,
    };
  }

  const authenticationRequired = response?.status === 401;
  const retryable = Number.isInteger(response?.status)
    && response.status >= 500
    && response.status <= 599;
  const fallbackMessage = authenticationRequired
    ? fallbackMessages.authentication
    : fallbackMessages.verification;
  const message = response?.status === 409
    ? "verifiedVisitLimitReached"
    : selectSafeApiMessage(result, fallbackMessage);

  return {
    type: authenticationRequired
      ? "authentication-required"
      : retryable
        ? "retryable-error"
        : "terminal-error",
    message,
    authenticationRequired,
    retryable,
  };
}

export function createVisitVerificationOperationController({
  authenticationConfirmed = false,
  stopStream = stopMediaStream,
  revokeUrl = revokeObjectUrl,
} = {}) {
  let isAuthenticationConfirmed = authenticationConfirmed === true;
  let currentToken = 0;
  let locationClaimed = false;
  let activeCapacityController = null;
  let capacityRemainingSlots = null;
  let cameraClaimed = false;
  let activeStream = null;
  let currentCapture = null;
  let activeSubmitController = null;
  let submissionClaimed = false;

  function releaseStream() {
    const stream = activeStream;
    activeStream = null;

    if (stream) {
      try {
        stopStream(stream);
      } catch {
        // Continue releasing the remaining operation resources.
      }
    }
  }

  function releaseCapture(capture) {
    const objectUrl = capture?.url;

    if (objectUrl) {
      try {
        revokeUrl(objectUrl);
      } catch {
        // Continue releasing the remaining operation resources.
      }
    }
  }

  function clearCurrentCapture() {
    const capture = currentCapture;
    currentCapture = null;
    releaseCapture(capture);
  }

  function isActiveStream(stream) {
    return Boolean(stream) && activeStream === stream;
  }

  function abortSubmission() {
    const controller = activeSubmitController;
    activeSubmitController = null;

    if (controller) {
      try {
        controller.abort();
      } catch {
        // Continue releasing the remaining operation resources.
      }
    }
  }

  function abortCapacity() {
    const controller = activeCapacityController;
    activeCapacityController = null;

    if (controller) {
      try {
        controller.abort();
      } catch {
        // Continue releasing the remaining operation resources.
      }
    }
  }

  function invalidate() {
    currentToken += 1;
    locationClaimed = false;
    capacityRemainingSlots = null;
    cameraClaimed = false;
    submissionClaimed = false;
    abortCapacity();
    abortSubmission();
    releaseStream();
    clearCurrentCapture();
    return currentToken;
  }

  function isCurrent(operationToken) {
    return (
      isAuthenticationConfirmed &&
      Number.isInteger(operationToken) &&
      operationToken === currentToken
    );
  }

  function updateAuthentication(nextAuthenticationConfirmed) {
    const wasAuthenticationConfirmed = isAuthenticationConfirmed;
    isAuthenticationConfirmed = nextAuthenticationConfirmed === true;

    if (isAuthenticationConfirmed) {
      return {
        authenticationConfirmed: true,
        operationInvalidated: false,
      };
    }

    const operationInvalidated =
      wasAuthenticationConfirmed ||
      locationClaimed ||
      Boolean(activeCapacityController) ||
      cameraClaimed ||
      Boolean(
        activeStream ||
        currentCapture ||
        activeSubmitController ||
        submissionClaimed
      );

    if (operationInvalidated) {
      invalidate();
    }

    return {
      authenticationConfirmed: false,
      operationInvalidated,
    };
  }

  function claimLocation() {
    if (
      !isAuthenticationConfirmed ||
      locationClaimed ||
      activeCapacityController ||
      cameraClaimed ||
      activeSubmitController
    ) {
      return null;
    }

    const operationToken = invalidate();
    locationClaimed = true;
    return operationToken;
  }

  function completeLocation(operationToken) {
    if (!isCurrent(operationToken) || !locationClaimed) {
      return false;
    }

    locationClaimed = false;
    return true;
  }

  function claimCapacity(operationToken, controller) {
    if (
      !isCurrent(operationToken) ||
      locationClaimed ||
      activeCapacityController ||
      cameraClaimed ||
      activeStream ||
      activeSubmitController ||
      !controller
    ) {
      return false;
    }

    capacityRemainingSlots = null;
    activeCapacityController = controller;
    return true;
  }

  function completeCapacity(operationToken, controller, remainingSlots) {
    if (
      !isCurrent(operationToken) ||
      activeCapacityController !== controller ||
      !Number.isInteger(remainingSlots) ||
      remainingSlots < 0 ||
      remainingSlots > VERIFIED_VISIT_DAILY_LIMIT
    ) {
      return false;
    }

    activeCapacityController = null;
    capacityRemainingSlots = remainingSlots;
    return true;
  }

  function claimCamera(operationToken) {
    if (
      !isCurrent(operationToken) ||
      locationClaimed ||
      activeCapacityController ||
      !Number.isInteger(capacityRemainingSlots) ||
      capacityRemainingSlots < 1 ||
      cameraClaimed ||
      activeStream ||
      activeSubmitController
    ) {
      return false;
    }

    cameraClaimed = true;
    return true;
  }

  function resolveCamera(operationToken, stream) {
    if (!isCurrent(operationToken) || !cameraClaimed) {
      try {
        stopStream(stream);
      } catch {
        // A stale stream must not interrupt the current operation.
      }
      return false;
    }

    cameraClaimed = false;
    releaseStream();
    activeStream = stream;
    return true;
  }

  function setCurrentCapture(operationToken, capture) {
    if (!isCurrent(operationToken) || submissionClaimed) {
      releaseCapture(capture);
      return false;
    }

    if (
      !capture ||
      typeof capture.url !== "string" ||
      capture.url.length === 0
    ) {
      return false;
    }

    clearCurrentCapture();
    currentCapture = capture;
    return true;
  }

  function retakeCurrentCapture(operationToken) {
    if (!isCurrent(operationToken) || !currentCapture) return false;
    clearCurrentCapture();
    return true;
  }

  function getCaptureState() {
    return {
      currentCapture,
    };
  }

  function setPreview(operationToken, objectUrl) {
    return setCurrentCapture(operationToken, { blob: null, url: objectUrl });
  }

  function clearPreview() {
    clearCurrentCapture();
  }

  function claimSubmission(
    operationToken,
    controller,
    { capturePending } = {}
  ) {
    if (
      !isCurrent(operationToken) ||
      locationClaimed ||
      cameraClaimed ||
      activeSubmitController ||
      !currentCapture?.blob ||
      capturePending !== false
    ) {
      return false;
    }

    activeSubmitController = controller;
    submissionClaimed = true;
    releaseStream();
    return true;
  }

  function canAcceptCaptureResult(operationToken) {
    return isCurrent(operationToken) && !submissionClaimed;
  }

  function completeSubmission(operationToken, controller) {
    if (
      !isCurrent(operationToken) ||
      activeSubmitController !== controller
    ) {
      return false;
    }

    activeSubmitController = null;
    return true;
  }

  function restartOperation() {
    if (
      !isAuthenticationConfirmed ||
      locationClaimed ||
      activeCapacityController ||
      cameraClaimed ||
      activeSubmitController
    ) {
      return null;
    }

    return invalidate();
  }

  return Object.freeze({
    updateAuthentication,
    claimLocation,
    completeLocation,
    claimCapacity,
    completeCapacity,
    claimCamera,
    resolveCamera,
    releaseStream,
    isActiveStream,
    setPreview,
    clearPreview,
    setCurrentCapture,
    retakeCurrentCapture,
    getCaptureState,
    canAcceptCaptureResult,
    claimSubmission,
    completeSubmission,
    restartOperation,
    isCurrent,
    invalidate,
  });
}

export function completeVerifiedVisitCanvasCapture({
  operationController,
  operationToken,
  blob,
  createObjectUrl,
  onAccepted,
  onFailure,
  onSettled,
}) {
  if (!operationController.canAcceptCaptureResult(operationToken)) {
    onSettled?.();
    return false;
  }

  if (!blob) {
    onFailure?.("The camera image could not be captured. Please try again.");
    return false;
  }

  let objectUrl;
  try {
    objectUrl = createObjectUrl(blob);
  } catch {
    if (!operationController.canAcceptCaptureResult(operationToken)) {
      onSettled?.();
      return false;
    }
    onFailure?.("The photo preview could not be created. Please try again.");
    return false;
  }

  const capture = { blob, url: objectUrl };
  if (!operationController.setCurrentCapture(operationToken, capture)) {
    onSettled?.();
    return false;
  }

  onAccepted?.(capture);
  return true;
}

export function getNearbyCandidatePresentations(attractions, position) {
  return findNearbyAttractions(
    Array.isArray(attractions) ? attractions : [],
    position
  ).map((candidate) => ({
    ...candidate,
    distanceLabel: `${Math.round(candidate.distanceMetres)} m away · ${candidate.radiusMeters} m verification radius`,
  }));
}

function formatOutsideDistanceMetres(distanceMetres) {
  const nearestInteger = Math.round(distanceMetres);
  if (
    Math.abs(distanceMetres - nearestInteger)
    <= DISTANCE_DISPLAY_TOLERANCE_METRES
  ) {
    return nearestInteger.toString();
  }

  return (
    Math.ceil(
      (distanceMetres - DISTANCE_DISPLAY_TOLERANCE_METRES) * 10
    ) / 10
  ).toFixed(1);
}

export function getNoNearbyAttractionMessage(attractions, position) {
  const nearest = findNearestToQualifyingAttraction(
    Array.isArray(attractions) ? attractions : [],
    position
  );

  if (!nearest) {
    return "No supported attraction is close enough to verify this visit.";
  }

  const name = nearest.attraction.name?.trim() || "The nearest supported attraction";
  const distanceMetres = formatOutsideDistanceMetres(nearest.distanceMetres);
  return `No supported attraction is close enough. ${name} is ${distanceMetres} metres away (allowed radius: ${nearest.radiusMeters} metres).`;
}

export function getGeolocationErrorMessage(error) {
  if (error?.code === 1) return "locationAccessDenied";
  if (error?.code === 2) return "locationUnavailable";
  if (error?.code === 3) return "locationTimeout";
  return "locationConfirmFailed";
}

export function getCameraErrorMessage(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) {
    return "cameraAccessDenied";
  }
  if (["NotFoundError", "OverconstrainedError"].includes(error?.name)) {
    return "cameraNotFound";
  }
  if (["NotReadableError", "AbortError"].includes(error?.name)) {
    return "cameraInUse";
  }
  return "cameraOpenFailed";
}

export function selectSafeApiMessage(result, fallbackMessage) {
  const message = result?.message;

  if (
    typeof message !== "string" ||
    CONTROL_CHARACTER_PATTERN.test(message) ||
    message.trim().length === 0 ||
    message.trim().length > MAX_PUBLIC_API_MESSAGE_LENGTH
  ) {
    return fallbackMessage;
  }

  return message.trim();
}

export function normaliseVerifiedVisitCapacity(payload, attractionId) {
  const expectedAttractionId =
    typeof attractionId === "string" ? attractionId.trim() : "";
  const capacity = payload?.data;

  if (
    payload?.success !== true ||
    !expectedAttractionId ||
    capacity?.attractionId !== expectedAttractionId ||
    !Number.isInteger(capacity?.existingTodayCount) ||
    !Number.isInteger(capacity?.dailyLimit) ||
    !Number.isInteger(capacity?.remainingSlots) ||
    capacity.dailyLimit !== VERIFIED_VISIT_DAILY_LIMIT ||
    capacity.existingTodayCount < 0 ||
    capacity.remainingSlots !== (capacity.existingTodayCount === 0 ? 1 : 0)
  ) {
    throw new Error(CAPACITY_ERROR_MESSAGE);
  }

  return {
    attractionId: capacity.attractionId,
    dailyLimit: capacity.dailyLimit,
    existingTodayCount: capacity.existingTodayCount,
    remainingSlots: capacity.remainingSlots,
  };
}

export function buildVerifiedVisitCapacityUrl(attractionId) {
  return `/api/exploration-map/verified-visits/capacity?attractionId=${encodeURIComponent(attractionId)}`;
}

export function getVerifiedVisitUploadLabel() {
  return "uploadPhoto";
}

export function getVerifiedVisitLimitReachedMessage() {
  return "verifiedVisitLimitReached";
}

export function canSubmitVerifiedVisitPhoto({
  flowState,
  currentCapture,
  capturePending,
  position,
  attractionId,
}) {
  return Boolean(
    ["preview", "upload-error"].includes(flowState) &&
    currentCapture?.blob &&
    typeof currentCapture?.url === "string" &&
    currentCapture.url.length > 0 &&
    capturePending === false &&
    position &&
    typeof attractionId === "string" &&
    attractionId.trim().length > 0
  );
}

export async function refreshVerifiedVisitConsumers({
  attractionId,
  refreshVisitedAttractions,
  publishPublicPhotoInvalidation,
}) {
  const safeAttractionId =
    typeof attractionId === "string" ? attractionId.trim() : "";
  if (!safeAttractionId) return;

  const refreshPromise = (async () => refreshVisitedAttractions?.())();
  let invalidationError;
  try {
    publishPublicPhotoInvalidation?.(safeAttractionId);
  } catch (error) {
    invalidationError = error;
  }

  let refreshError;
  try {
    await refreshPromise;
  } catch (error) {
    refreshError = error;
  }

  if (invalidationError) throw invalidationError;
  if (refreshError) throw refreshError;
}

function createCryptographicallyStrongSubmissionKey(crypto) {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto?.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hexadecimal = [...bytes]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    return [
      hexadecimal.slice(0, 8),
      hexadecimal.slice(8, 12),
      hexadecimal.slice(12, 16),
      hexadecimal.slice(16, 20),
      hexadecimal.slice(20),
    ].join("-");
  }

  throw new Error("Secure browser randomness is unavailable.");
}

export function createVerifiedVisitSubmissionKeyStore({
  crypto = globalThis.crypto,
} = {}) {
  let submissionKey;

  return Object.freeze({
    getOrCreate() {
      if (!submissionKey) {
        submissionKey = normaliseVerifiedVisitSubmissionKey(
          createCryptographicallyStrongSubmissionKey(crypto)
        );
      }
      return submissionKey;
    },
    reset() {
      submissionKey = undefined;
    },
  });
}

export function createVerifiedVisitFormData({
  photoBlob,
  attractionId,
  position,
  submissionKey,
}) {
  const formData = new FormData();
  formData.set("photo", photoBlob, "verified-visit.jpg");
  formData.set("attractionId", attractionId);
  formData.set("latitude", String(position.latitude));
  formData.set("longitude", String(position.longitude));
  formData.set("accuracyMeters", String(position.accuracyMeters));
  if (submissionKey) {
    formData.set(
      "submissionKey",
      normaliseVerifiedVisitSubmissionKey(submissionKey)
    );
  }
  return formData;
}

export function stopMediaStream(stream) {
  if (typeof stream?.getTracks !== "function") {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track?.stop?.();
    } catch {
      // Continue stopping the remaining tracks if one browser track fails.
    }
  });
}

export function revokeObjectUrl(objectUrl, urlApi = globalThis.URL) {
  if (
    typeof objectUrl !== "string" ||
    objectUrl.length === 0 ||
    typeof urlApi?.revokeObjectURL !== "function"
  ) {
    return;
  }

  try {
    urlApi.revokeObjectURL(objectUrl);
  } catch {
    // Browsers may reject URLs created by another context during teardown.
  }
}
