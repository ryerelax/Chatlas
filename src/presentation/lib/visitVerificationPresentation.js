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
  const authenticationConfirmed =
    visitedDataStatus === VISITED_DATA_STATUS.SUCCESS &&
    !developmentPreviewActive;
  const authenticationPending =
    visitedDataStatus === VISITED_DATA_STATUS.LOADING;
  const authenticationRequired =
    visitedDataStatus === VISITED_DATA_STATUS.AUTH_REQUIRED;

  return {
    authenticationConfirmed,
    authenticationPending,
    authenticationRequired,
    authenticationUnavailable:
      !authenticationConfirmed &&
      !authenticationPending &&
      !authenticationRequired,
  };
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
