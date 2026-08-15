export const VERIFIED_PHOTOS_LOAD_ERROR =
  "Verified visitor photos could not be loaded.";
export const VERIFIED_PHOTO_DELETE_ERROR =
  "The verified photo could not be deleted. Please try again.";

function requirePublicCard(card) {
  const capturedTime = new Date(card?.capturedDate).getTime();
  if (
    typeof card?.visitId !== "string"
    || typeof card?.photoId !== "string"
    || typeof card?.attractionId !== "string"
    || typeof card?.photoUrl !== "string"
    || !Number.isFinite(capturedTime)
    || typeof card?.user?.displayName !== "string"
    || card?.verified !== true
  ) {
    throw new Error(VERIFIED_PHOTOS_LOAD_ERROR);
  }

  return {
    visitId: card.visitId,
    photoId: card.photoId,
    attractionId: card.attractionId,
    photoUrl: card.photoUrl,
    capturedDate: new Date(capturedTime).toISOString(),
    user: {
      displayName: card.user.displayName,
      avatarUrl: typeof card.user.avatarUrl === "string" ? card.user.avatarUrl : "",
    },
    verified: true,
    canDelete: card.canDelete === true,
  };
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

export function formatMalaysiaDisplayDate(capturedDate) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(capturedDate));
}

export function buildVerifiedPhotoDeleteUrl({ visitId, photoId }) {
  return `/api/exploration-map/verified-visits/${encodeURIComponent(visitId)}/photos/${encodeURIComponent(photoId)}`;
}
