import { getPublicProfileById } from "@/business/services/userService";
import { getExplorationMapAttractions } from "@/business/services/explorationMapAttractionService";
import {
  createExplorationMapViewModel,
  normaliseMapAttractions,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";
import {
  countPublicReviewsByUserId,
  findPublicReviewsByUserId,
  findReviewedAttractionIdsByUserId,
} from "@/data/repositories/reviewRepository";
import { getPublicExplorationSummaries } from "@/business/services/publicExplorationSummaryService";

export class SocialProfileDependencyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SocialProfileDependencyError";
    this.code = code;
  }
}

export function createPublicProfileOverviewService({
  getPublicProfileById: getProfileById,
  countPublicReviewsByUserId: countReviews,
  getPublicExplorationSummaries: getExplorationSummaries,
}) {
  return async function getOverview(userId) {
    const profile = await getProfileById(userId);
    if (!profile) return null;

    const [reviewsWritten, summaries] = await Promise.all([
      countReviews(profile.id),
      getExplorationSummaries([profile.id]),
    ]);
    const explorationSummary = summaries.get(String(profile.id)) || null;
    const hasExplorationSummary = explorationSummary?.status === "success";

    return {
      ...profile,
      activitySummary: {
        reviewsWritten: Math.max(0, Math.trunc(Number(reviewsWritten) || 0)),
        visitedAttractions: hasExplorationSummary
          ? explorationSummary.visitedCount
          : null,
        explorationProgress: hasExplorationSummary
          ? explorationSummary.progressPercentage
          : null,
        status: hasExplorationSummary ? "success" : "partial",
      },
    };
  };
}

const getPublicProfileOverviewService = createPublicProfileOverviewService({
  getPublicProfileById,
  countPublicReviewsByUserId,
  getPublicExplorationSummaries,
});

export async function getPublicProfileOverview(userId) {
  return getPublicProfileOverviewService(userId);
}

function normalizeReviewedAttractions(attractions = []) {
  const uniqueAttractions = new Map();

  for (const attraction of attractions) {
    const id = String(attraction?.id || attraction?._id || "");
    if (!id || uniqueAttractions.has(id)) continue;

    uniqueAttractions.set(id, {
      id,
      name: attraction.name || "Unnamed attraction",
      locationArea: attraction.locationArea || "",
      address: attraction.address || "",
      category: attraction.category || "Attraction",
      latitude: attraction.latitude,
      longitude: attraction.longitude,
    });
  }

  return [...uniqueAttractions.values()];
}

function calculateCoverage(reviewedCount, totalAttractions) {
  const normalizedTotal = Math.max(0, Number(totalAttractions) || 0);
  if (normalizedTotal === 0) return 0;

  return Math.min(
    100,
    Math.round((reviewedCount / normalizedTotal) * 1000) / 10
  );
}

export function buildExplorationComparison({
  viewerAttractions = [],
  targetAttractions = [],
  totalAttractions = 0,
} = {}) {
  const viewer = normalizeReviewedAttractions(viewerAttractions);
  const target = normalizeReviewedAttractions(targetAttractions);
  const viewerIds = new Set(viewer.map((attraction) => attraction.id));
  const targetIds = new Set(target.map((attraction) => attraction.id));

  return {
    viewer: {
      reviewedCount: viewer.length,
      coveragePercentage: calculateCoverage(viewer.length, totalAttractions),
    },
    target: {
      reviewedCount: target.length,
      coveragePercentage: calculateCoverage(target.length, totalAttractions),
    },
    common: viewer.filter((attraction) => targetIds.has(attraction.id)),
    viewerOnly: viewer.filter((attraction) => !targetIds.has(attraction.id)),
    targetOnly: target.filter((attraction) => !viewerIds.has(attraction.id)),
  };
}

function serializePublicReview(review) {
  const attraction = review.attractionId;
  const createdAt = review.createdAt ? new Date(review.createdAt) : null;

  return {
    id: String(review._id),
    rating: Number(review.rating) || 0,
    text: review.reviewText?.trim() || "",
    photos: Array.isArray(review.photos)
      ? review.photos
          .map((photo) => photo?.url)
          .filter((photoUrl) => typeof photoUrl === "string" && photoUrl)
      : [],
    createdAt:
      createdAt && !Number.isNaN(createdAt.getTime())
        ? createdAt.toISOString()
        : null,
    attraction:
      attraction?._id && attraction?.name
        ? {
            id: String(attraction._id),
            name: attraction.name,
          }
        : null,
  };
}

export function createPublicProfileReviewsService({
  getPublicProfileById: getProfileById,
  findPublicReviewsByUserId: findReviewsByUserId,
}) {
  return async function getReviewsForProfile(userId) {
    const profile = await getProfileById(userId);
    if (!profile) return null;

    const reviews = await findReviewsByUserId(profile.id);
    return reviews.map(serializePublicReview);
  };
}

const getReviewsForProfile = createPublicProfileReviewsService({
  getPublicProfileById,
  findPublicReviewsByUserId,
});

export async function getPublicReviewsForProfile(userId) {
  return getReviewsForProfile(userId);
}

function serializeReviewedAttraction(attraction) {
  return {
    id: attraction.id,
    name: attraction.name,
    address: attraction.address,
    category: attraction.category,
    latitude: attraction.latitude,
    longitude: attraction.longitude,
  };
}

export function createPublicProfileExplorationService({
  getPublicProfileById: getProfileById,
  getExplorationMapAttractions: getMapAttractions,
  findReviewedAttractionIdsByUserId: findReviewedAttractionIds,
}) {
  return async function getExplorationForProfile(userId) {
    const profile = await getProfileById(userId);
    if (!profile) return null;

    const [mapAttractionRecords, reviewedAttractionIds] = await Promise.all([
      getMapAttractions(),
      findReviewedAttractionIds(profile.id),
    ]);
    const supportedAttractions = normaliseMapAttractions(mapAttractionRecords);
    const viewModel = createExplorationMapViewModel(
      supportedAttractions,
      reviewedAttractionIds,
      VISITED_DATA_STATUS.SUCCESS
    );

    return {
      source: "public_reviews",
      reviewedAttractions: viewModel.visitedAttractions.map(
        serializeReviewedAttraction
      ),
      reviewedCount: viewModel.progress.visitedCount,
      totalAttractions: viewModel.progress.totalCount,
      coveragePercentage: viewModel.progress.percentage,
    };
  };
}

const getExplorationForProfile = createPublicProfileExplorationService({
  getPublicProfileById,
  getExplorationMapAttractions,
  findReviewedAttractionIdsByUserId,
});

export async function getPublicExplorationForProfile(userId) {
  return getExplorationForProfile(userId);
}

export function createPublicExplorationComparisonService({
  getPublicProfileById: getProfileById,
  getExplorationMapAttractions: getMapAttractions,
  findReviewedAttractionIdsByUserId: findReviewedAttractionIds,
}) {
  return async function compareExploration(viewerId, targetUserId) {
    const targetProfile = await getProfileById(targetUserId);
    if (!targetProfile) return null;

    const normalizedViewerId = String(viewerId || "");
    if (normalizedViewerId === String(targetProfile.id)) {
      throw new SocialProfileDependencyError(
        "SELF_COMPARISON_NOT_ALLOWED",
        "Choose another traveller to compare reviewed places."
      );
    }

    const [mapAttractionRecords, viewerReviewedIds, targetReviewedIds] =
      await Promise.all([
        getMapAttractions(),
        findReviewedAttractionIds(normalizedViewerId),
        findReviewedAttractionIds(targetProfile.id),
      ]);
    const supportedAttractions = normaliseMapAttractions(mapAttractionRecords);
    const viewerViewModel = createExplorationMapViewModel(
      supportedAttractions,
      viewerReviewedIds,
      VISITED_DATA_STATUS.SUCCESS
    );
    const targetViewModel = createExplorationMapViewModel(
      supportedAttractions,
      targetReviewedIds,
      VISITED_DATA_STATUS.SUCCESS
    );

    return buildExplorationComparison({
      viewerAttractions: viewerViewModel.visitedAttractions,
      targetAttractions: targetViewModel.visitedAttractions,
      totalAttractions: supportedAttractions.length,
    });
  };
}

const compareExploration = createPublicExplorationComparisonService({
  getPublicProfileById,
  getExplorationMapAttractions,
  findReviewedAttractionIdsByUserId,
});

export async function comparePublicExploration(viewerId, targetUserId) {
  return compareExploration(viewerId, targetUserId);
}
