import { getExplorationMapAttractions } from "@/business/services/explorationMapAttractionService";
import {
  normaliseMapAttractions,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";
import { createExplorationRank } from "@/business/services/explorationRankService";
import { findDistinctVerifiedAttractionCountsByUserIds } from "@/data/repositories/socialProfileExplorationRepository";

function calculateProgressPercentage(visitedCount, totalCount) {
  if (totalCount <= 0) return 0;

  return Math.min(
    100,
    Math.round((visitedCount / totalCount) * 1000) / 10
  );
}

export function createSafePublicExplorationSummary({
  visitedCount = 0,
  totalCount = 0,
} = {}) {
  const normalizedTotalCount = Math.max(0, Math.trunc(Number(totalCount) || 0));
  const normalizedVisitedCount = Math.min(
    normalizedTotalCount,
    Math.max(0, Math.trunc(Number(visitedCount) || 0))
  );

  if (normalizedTotalCount === 0) {
    return Object.freeze({
      status: "unavailable",
      visitedCount: 0,
      totalCount: 0,
      progressPercentage: 0,
      rank: null,
    });
  }

  const progressPercentage = calculateProgressPercentage(
    normalizedVisitedCount,
    normalizedTotalCount
  );
  const rank = createExplorationRank({
    status: VISITED_DATA_STATUS.SUCCESS,
    visitedCount: normalizedVisitedCount,
    totalCount: normalizedTotalCount,
    percentage: progressPercentage,
  });

  return Object.freeze({
    status: "success",
    visitedCount: normalizedVisitedCount,
    totalCount: normalizedTotalCount,
    progressPercentage,
    rank,
  });
}

export function createPublicExplorationSummaryService({
  getExplorationMapAttractions: getMapAttractions,
  findDistinctVerifiedAttractionCountsByUserIds: findVerifiedCounts,
}) {
  return async function getPublicExplorationSummaries(userIds = []) {
    const normalizedUserIds = [...new Set(userIds.map(String).filter(Boolean))];
    if (normalizedUserIds.length === 0) return new Map();

    const supportedAttractions = normaliseMapAttractions(
      await getMapAttractions()
    );
    const totalCount = supportedAttractions.length;
    const countRecords = await findVerifiedCounts(
      normalizedUserIds,
      supportedAttractions.map((attraction) => attraction.id)
    );
    const countByUserId = new Map(
      countRecords.map((record) => [
        String(record.userId),
        Number(record.visitedCount) || 0,
      ])
    );

    return new Map(
      normalizedUserIds.map((userId) => [
        userId,
        createSafePublicExplorationSummary({
          visitedCount: countByUserId.get(userId) || 0,
          totalCount,
        }),
      ])
    );
  };
}

const getPublicExplorationSummariesService =
  createPublicExplorationSummaryService({
    getExplorationMapAttractions,
    findDistinctVerifiedAttractionCountsByUserIds,
  });

export async function getPublicExplorationSummaries(userIds) {
  return getPublicExplorationSummariesService(userIds);
}
