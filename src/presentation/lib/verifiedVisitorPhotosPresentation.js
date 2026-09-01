import { formatLocaleDate } from "@/presentation/lib/formatLocaleDate";


export const VERIFIED_PHOTOS_LOAD_ERROR =
  "Verified visitor photos could not be loaded.";
export const VERIFIED_PHOTO_DELETE_ERROR =
  "The verified photo could not be deleted. Please try again.";
export const VERIFIED_VISITOR_PHOTOS_INVALIDATED_EVENT =
  "chatlas:verified-visitor-photos-invalidated";

function requirePublicCard(card) {
  const visitId = normaliseRequiredString(card?.visitId);
  const photoId = normaliseRequiredString(card?.photoId);
  const attractionId = normaliseRequiredString(card?.attractionId);
  const photoUrl = normaliseCloudinaryPhotoUrl(card?.photoUrl);
  const capturedDate = normaliseRequiredString(card?.capturedDate);
  const capturedTime = capturedDate ? new Date(capturedDate).getTime() : Number.NaN;
  if (
    !visitId
    || !photoId
    || !attractionId
    || !photoUrl
    || !Number.isFinite(capturedTime)
    || typeof card?.user?.displayName !== "string"
    || card?.verified !== true
  ) {
    throw new Error(VERIFIED_PHOTOS_LOAD_ERROR);
  }

  return {
    visitId,
    photoId,
    attractionId,
    photoUrl,
    capturedDate: new Date(capturedTime).toISOString(),
    user: {
      displayName: card.user.displayName,
      avatarUrl: normaliseSafeAvatarUrl(card.user.avatarUrl),
    },
    verified: true,
    canDelete: card.canDelete === true,
  };
}

function normaliseRequiredString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseHttpsUrl(value) {
  const candidate = normaliseRequiredString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function normaliseCloudinaryPhotoUrl(value) {
  const url = parseHttpsUrl(value);
  if (
    !url
    || url.hostname !== "res.cloudinary.com"
    || url.port
    || url.pathname === "/"
  ) {
    return "";
  }

  return url.toString();
}

function normaliseSafeAvatarUrl(value) {
  const url = parseHttpsUrl(value);
  return url ? url.toString() : "";
}

export function normaliseVerifiedPhotosPayload(payload) {
  if (payload?.success !== true || !Array.isArray(payload.data)) {
    throw new Error(VERIFIED_PHOTOS_LOAD_ERROR);
  }

  return payload.data
    .map(requirePublicCard)
    .sort((first, second) => (
      new Date(second.capturedDate).getTime() - new Date(first.capturedDate).getTime()
    ));
}

export function formatMalaysiaDisplayDate(capturedDate, lang = "en") {
  return formatLocaleDate(capturedDate, lang, "long") || "";
}

export function buildVerifiedPhotoDeleteUrl({ visitId, photoId }) {
  return `/api/exploration-map/verified-visits/${encodeURIComponent(visitId)}/photos/${encodeURIComponent(photoId)}`;
}

export function getVerifiedPhotoDeleteResponseDecision(
  response,
  { aborted = false } = {}
) {
  if (aborted) return { type: "cancelled" };
  if (response?.status === 204) return { type: "success" };
  if (response?.status === 401) return { type: "authentication-required" };
  return { type: "retryable-error" };
}

export function getVerifiedPhotoDeleteActionState(
  photo,
  { authenticationRequired, deletionPending }
) {
  if (authenticationRequired || photo?.canDelete !== true) return "hidden";
  return deletionPending ? "disabled" : "enabled";
}

export function removeConfirmedVerifiedPhoto(photos, photoId) {
  if (!Array.isArray(photos)) return [];
  return photos.filter((photo) => photo?.photoId !== photoId);
}

export function getVerifiedPhotoLoadFailureDecision(requestKind) {
  if (requestKind === "refresh") {
    return {
      status: "success",
      preservePhotos: true,
      showRefreshError: true,
    };
  }

  return {
    status: "error",
    preservePhotos: false,
    showRefreshError: false,
  };
}

export function isMatchingVerifiedVisitorPhotosInvalidation(
  event,
  attractionId
) {
  const expectedAttractionId = normaliseRequiredString(attractionId);
  return Boolean(
    expectedAttractionId &&
    normaliseRequiredString(event?.detail?.attractionId) ===
      expectedAttractionId
  );
}

export function publishVerifiedVisitorPhotosInvalidation(
  attractionId,
  {
    eventTarget = globalThis.window,
    eventFactory = (type, init) => new CustomEvent(type, init),
  } = {}
) {
  const safeAttractionId = normaliseRequiredString(attractionId);
  if (!safeAttractionId || typeof eventTarget?.dispatchEvent !== "function") {
    return false;
  }

  const event = eventFactory(VERIFIED_VISITOR_PHOTOS_INVALIDATED_EVENT, {
    detail: { attractionId: safeAttractionId },
  });
  eventTarget.dispatchEvent(event);
  return true;
}
