export const EXPLORER_RANK = Object.freeze({
  NEW: "new",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
  MASTER: "master",
});

const PERCENTAGE_TENTHS = 10;
const COMPLETE_PERCENTAGE_TENTHS = 100 * PERCENTAGE_TENTHS;
const HIGHEST_INCOMPLETE_PERCENTAGE_TENTHS =
  COMPLETE_PERCENTAGE_TENTHS - 1;
const RANK_THRESHOLDS = Object.freeze([
  { id: EXPLORER_RANK.NEW, minimumTenths: 0 },
  { id: EXPLORER_RANK.BRONZE, minimumTenths: 100 },
  { id: EXPLORER_RANK.SILVER, minimumTenths: 350 },
  { id: EXPLORER_RANK.GOLD, minimumTenths: 650 },
  { id: EXPLORER_RANK.MASTER, minimumTenths: 1000 },
]);

function normalisePercentageTenths(value) {
  if (!Number.isFinite(value)) return null;

  const clampedPercentage = Math.min(100, Math.max(0, value));
  return Math.min(
    COMPLETE_PERCENTAGE_TENTHS,
    Math.max(
      0,
      Math.round((clampedPercentage + Number.EPSILON) * PERCENTAGE_TENTHS)
    )
  );
}

export function createExplorationRank(progress) {
  if (progress?.status !== "success") return null;

  const { visitedCount, totalCount } = progress;
  if (
    !Number.isInteger(visitedCount) ||
    !Number.isInteger(totalCount) ||
    visitedCount < 0 ||
    totalCount <= 0 ||
    visitedCount > totalCount
  ) {
    return null;
  }

  const percentageTenths = normalisePercentageTenths(progress.percentage);
  if (percentageTenths === null) return null;

  const isComplete =
    visitedCount === totalCount &&
    percentageTenths === COMPLETE_PERCENTAGE_TENTHS;
  const effectivePercentageTenths = isComplete
    ? COMPLETE_PERCENTAGE_TENTHS
    : Math.min(
        percentageTenths,
        HIGHEST_INCOMPLETE_PERCENTAGE_TENTHS
      );
  const eligibleRanks = isComplete
    ? RANK_THRESHOLDS
    : RANK_THRESHOLDS.slice(0, -1);
  const rank = eligibleRanks.reduce(
    (current, candidate) =>
      effectivePercentageTenths >= candidate.minimumTenths
        ? candidate
        : current,
    eligibleRanks[0]
  );
  const rankIndex = RANK_THRESHOLDS.findIndex(
    (candidate) => candidate.id === rank.id
  );
  const nextRank = RANK_THRESHOLDS[rankIndex + 1] || null;

  return Object.freeze({
    id: rank.id,
    nextRankId: nextRank?.id || null,
    normalizedPercentage:
      effectivePercentageTenths / PERCENTAGE_TENTHS,
    percentageToNext: nextRank
      ? Math.max(
          1,
          nextRank.minimumTenths - effectivePercentageTenths
        ) / PERCENTAGE_TENTHS
      : 0,
    isComplete,
  });
}
