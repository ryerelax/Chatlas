import { getPublicProfileById } from "@/business/services/userService";

export class SocialProfileDependencyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SocialProfileDependencyError";
    this.code = code;
  }
}

function normalizeVisitedAttractions(attractions = []) {
  const uniqueAttractions = new Map();

  for (const attraction of attractions) {
    const id = String(attraction?.id || attraction?._id || "");
    if (!id || uniqueAttractions.has(id)) continue;

    uniqueAttractions.set(id, {
      id,
      name: attraction.name || "Unnamed attraction",
      locationArea: attraction.locationArea || "",
      latitude: attraction.latitude,
      longitude: attraction.longitude,
    });
  }

  return [...uniqueAttractions.values()];
}

function calculateProgress(visitedCount, totalAttractions) {
  const normalizedTotal = Math.max(0, Number(totalAttractions) || 0);
  if (normalizedTotal === 0) return 0;

  return Math.min(100, Math.round((visitedCount / normalizedTotal) * 100));
}

export function buildExplorationComparison({
  viewerAttractions = [],
  targetAttractions = [],
  totalAttractions = 0,
} = {}) {
  const viewer = normalizeVisitedAttractions(viewerAttractions);
  const target = normalizeVisitedAttractions(targetAttractions);
  const viewerIds = new Set(viewer.map((attraction) => attraction.id));
  const targetIds = new Set(target.map((attraction) => attraction.id));

  return {
    viewer: {
      visitedCount: viewer.length,
      progressPercentage: calculateProgress(viewer.length, totalAttractions),
    },
    target: {
      visitedCount: target.length,
      progressPercentage: calculateProgress(target.length, totalAttractions),
    },
    common: viewer.filter((attraction) => targetIds.has(attraction.id)),
    viewerOnly: viewer.filter((attraction) => !targetIds.has(attraction.id)),
    targetOnly: target.filter((attraction) => !viewerIds.has(attraction.id)),
  };
}

export async function getPublicReviewsForProfile(userId) {
  const profile = await getPublicProfileById(userId);
  if (!profile) return null;

  // TODO: Replace this dependency state with Review repository data when the
  // Review & Community module introduces its approved Review model and service.
  throw new SocialProfileDependencyError(
    "REVIEWS_UNAVAILABLE",
    "Reviews are not available yet because the Review & Community module has not been integrated."
  );
}

export async function getPublicExplorationForProfile(userId) {
  const profile = await getPublicProfileById(userId);
  if (!profile) return null;

  // TODO: Replace this dependency state with visited-attraction records when
  // the Exploration Map module publishes its approved repository and service.
  throw new SocialProfileDependencyError(
    "EXPLORATION_UNAVAILABLE",
    "Exploration data is not available yet because the Exploration Map module has not been integrated."
  );
}

export async function comparePublicExploration(viewerId, targetUserId) {
  const targetProfile = await getPublicProfileById(targetUserId);
  if (!targetProfile) return null;

  if (viewerId === targetUserId) {
    throw new SocialProfileDependencyError(
      "SELF_COMPARISON_NOT_ALLOWED",
      "Choose another traveller to compare exploration progress."
    );
  }

  // TODO: Call buildExplorationComparison here after the Exploration Map
  // module exposes both users' persisted visited-attraction records.
  throw new SocialProfileDependencyError(
    "COMPARISON_UNAVAILABLE",
    "Exploration comparison is not available until visited-attraction records are integrated."
  );
}
