import {
  findNearbyAttractions,
  validateGeolocationEvidence,
} from "@/business/services/visitVerificationRules";
import { VISITED_DATA_STATUS } from "@/business/services/explorationMapService";

const MAX_PUBLIC_API_MESSAGE_LENGTH = 200;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

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
    };
  }

  const authenticationRequired = response?.status === 401;
  const fallbackMessage = authenticationRequired
    ? fallbackMessages.authentication
    : fallbackMessages.verification;

  return {
    type: authenticationRequired ? "authentication-required" : "error",
    message: selectSafeApiMessage(result, fallbackMessage),
    authenticationRequired,
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
  let cameraClaimed = false;
  let activeStream = null;
  let activePreviewUrl = "";
  let activeSubmitController = null;

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

  function clearPreview() {
    const objectUrl = activePreviewUrl;
    activePreviewUrl = "";

    if (objectUrl) {
      try {
        revokeUrl(objectUrl);
      } catch {
        // Continue releasing the remaining operation resources.
      }
    }
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

  function invalidate() {
    currentToken += 1;
    locationClaimed = false;
    cameraClaimed = false;
    abortSubmission();
    releaseStream();
    clearPreview();
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
      cameraClaimed ||
      Boolean(activeStream || activePreviewUrl || activeSubmitController);

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

  function claimCamera(operationToken) {
    if (
      !isCurrent(operationToken) ||
      locationClaimed ||
      cameraClaimed ||
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

  function setPreview(operationToken, objectUrl) {
    if (!isCurrent(operationToken)) {
      if (objectUrl) {
        try {
          revokeUrl(objectUrl);
        } catch {
          // A stale preview must not interrupt the current operation.
        }
      }
      return false;
    }

    clearPreview();
    activePreviewUrl = objectUrl;
    return true;
  }

  function claimSubmission(operationToken, controller) {
    if (
      !isCurrent(operationToken) ||
      locationClaimed ||
      cameraClaimed ||
      activeSubmitController
    ) {
      return false;
    }

    activeSubmitController = controller;
    return true;
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
    claimCamera,
    resolveCamera,
    releaseStream,
    isActiveStream,
    setPreview,
    clearPreview,
    claimSubmission,
    completeSubmission,
    restartOperation,
    isCurrent,
    invalidate,
  });
}

export function getNearbyCandidatePresentations(attractions, position) {
  return findNearbyAttractions(
    Array.isArray(attractions) ? attractions : [],
    position
  ).map((candidate) => ({
    ...candidate,
    distanceLabel: `${Math.round(candidate.distanceMetres)} m away`,
  }));
}

export function getGeolocationErrorMessage(error) {
  if (error?.code === 1) {
    return "Location access was denied. Allow location access and try again.";
  }

  if (error?.code === 2) {
    return "Your current location is unavailable. Move to an open area and try again.";
  }

  if (error?.code === 3) {
    return "Finding your current location timed out. Try again where you have a clear signal.";
  }

  return "We could not confirm your current location. Please try again.";
}

export function getCameraErrorMessage(error) {
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) {
    return "Camera access was denied. Allow camera access and try again.";
  }

  if (["NotFoundError", "OverconstrainedError"].includes(error?.name)) {
    return "A usable camera was not found on this device.";
  }

  if (["NotReadableError", "AbortError"].includes(error?.name)) {
    return "The camera is unavailable or already in use. Close other camera apps and try again.";
  }

  return "We could not open the camera. Please try again.";
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

export function createVerifiedVisitFormData({
  photoBlob,
  attractionId,
  position,
}) {
  const formData = new FormData();
  formData.set("photo", photoBlob, "verified-visit.jpg");
  formData.set("attractionId", attractionId);
  formData.set("latitude", String(position.latitude));
  formData.set("longitude", String(position.longitude));
  formData.set("accuracyMeters", String(position.accuracyMeters));
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
