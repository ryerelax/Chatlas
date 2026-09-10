import mongoose from "mongoose";
import { getPublicExplorationSummaries } from "@/business/services/publicExplorationSummaryService";
import {
  findPublicUserById,
  findPublicUsers,
  findUserByIdentity,
} from "@/data/repositories/userRepository";
import { countPublicReviewsByUserIds } from "@/data/repositories/reviewRepository";

const PUBLIC_PROFILE_PAGE_SIZE = 12;
const MAX_SEARCH_LENGTH = 80;
const DIRECTORY_RANK_FILTERS = new Set([
  "all",
  "new",
  "bronze",
  "silver",
  "gold",
  "master",
]);
const DIRECTORY_SORTS = new Set([
  "name",
  "most-explored",
  "most-reviews",
  "newest-members",
]);

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBooleanFilter(value) {
  return value === true || value === "true" || value === "1";
}

function compareProfileNames(firstProfile, secondProfile) {
  return (
    firstProfile.displayName.localeCompare(secondProfile.displayName, "en", {
      sensitivity: "base",
    }) || firstProfile.id.localeCompare(secondProfile.id)
  );
}

function getJoinedTimestamp(profile) {
  const timestamp = Date.parse(profile.joinedAt || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortPublicProfiles(profiles, sort) {
  return [...profiles].sort((firstProfile, secondProfile) => {
    if (sort === "most-explored") {
      return (
        (secondProfile.activitySummary.visitedAttractions || 0) -
          (firstProfile.activitySummary.visitedAttractions || 0) ||
        compareProfileNames(firstProfile, secondProfile)
      );
    }

    if (sort === "most-reviews") {
      return (
        secondProfile.activitySummary.reviewsWritten -
          firstProfile.activitySummary.reviewsWritten ||
        compareProfileNames(firstProfile, secondProfile)
      );
    }

    if (sort === "newest-members") {
      return (
        getJoinedTimestamp(secondProfile) - getJoinedTimestamp(firstProfile) ||
        compareProfileNames(firstProfile, secondProfile)
      );
    }

    return compareProfileNames(firstProfile, secondProfile);
  });
}

function serializePublicProfile(user) {
  const joinedAt = user.joinedAt || user.createdAt || null;

  return {
    id: String(user._id),
    displayName:
      user.displayName?.trim() || user.name?.trim() || "Chatlas traveller",
    profilePicture: user.profilePicture || "",
    bio: user.bio?.trim() || "",
    location: user.location?.trim() || "",
    joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
    activitySummary: {
      reviewsWritten: null,
      visitedAttractions: null,
      explorationProgress: null,
      status: "unavailable",
    },
  };
}

function serializeCurrentProfile(user) {
  return {
    id: String(user._id),
    displayName:
      user.displayName?.trim() || user.name?.trim() || "Chatlas traveller",
    profilePicture: user.profilePicture || "",
    bio: user.bio?.trim() || "",
    location: user.location?.trim() || "",
  };
}

export function createSocialProfileUserService({
  findPublicUsers: findProfiles,
  findPublicUserById: findProfileById,
  findUserByIdentity: findProfileByIdentity,
  getPublicExplorationSummaries: getExplorationSummaries = async () => new Map(),
  countPublicReviewsByUserIds: countReviewsByUserIds = async () => [],
  isValidObjectId = mongoose.Types.ObjectId.isValid,
}) {
  return {
    async getPublicProfiles({
      search = "",
      page = 1,
      excludedGoogleId = "",
      rank = "all",
      sort = "name",
      hasReviews = false,
      hasProfileDetails = false,
    } = {}) {
      const normalizedSearch = String(search)
        .trim()
        .slice(0, MAX_SEARCH_LENGTH);
      const normalizedPage = Math.max(1, Math.trunc(Number(page) || 1));
      const normalizedRank = DIRECTORY_RANK_FILTERS.has(String(rank))
        ? String(rank)
        : "all";
      const normalizedSort = DIRECTORY_SORTS.has(String(sort))
        ? String(sort)
        : "name";
      const requireReviews = normalizeBooleanFilter(hasReviews);
      const requireProfileDetails = normalizeBooleanFilter(hasProfileDetails);
      const searchPattern = normalizedSearch
        ? escapeRegularExpression(normalizedSearch)
        : "";

      const { items } = await findProfiles({
        searchPattern,
        excludedGoogleId,
        paginate: false,
      });

      const serializedItems = items.map(serializePublicProfile);
      const profileIds = serializedItems.map((profile) => profile.id);
      const [explorationSummaries, reviewCountRecords] = await Promise.all([
        getExplorationSummaries(profileIds),
        countReviewsByUserIds(profileIds),
      ]);
      const reviewCountByUserId = new Map(
        reviewCountRecords.map((record) => [
          String(record.userId),
          Math.max(0, Math.trunc(Number(record.reviewsWritten) || 0)),
        ])
      );
      const enrichedProfiles = serializedItems.map((profile) => {
        const summary = explorationSummaries.get(profile.id);
        const hasSummary = summary?.status === "success";

        return {
          ...profile,
          activitySummary: {
            ...profile.activitySummary,
            reviewsWritten: reviewCountByUserId.get(profile.id) || 0,
            visitedAttractions: hasSummary ? summary.visitedCount : null,
            explorationProgress: hasSummary
              ? summary.progressPercentage
              : null,
            rank: hasSummary ? summary.rank : null,
            status: hasSummary ? "success" : "unavailable",
          },
        };
      });
      const filteredProfiles = enrichedProfiles.filter((profile) => {
        if (
          normalizedRank !== "all" &&
          profile.activitySummary.rank?.id !== normalizedRank
        ) {
          return false;
        }
        if (requireReviews && profile.activitySummary.reviewsWritten === 0) {
          return false;
        }
        if (requireProfileDetails && !profile.bio && !profile.location) {
          return false;
        }
        return true;
      });
      const sortedProfiles = sortPublicProfiles(
        filteredProfiles,
        normalizedSort
      );
      const total = sortedProfiles.length;
      const totalPages = Math.max(
        1,
        Math.ceil(total / PUBLIC_PROFILE_PAGE_SIZE)
      );
      const resolvedPage = Math.min(normalizedPage, totalPages);
      const pageStart = (resolvedPage - 1) * PUBLIC_PROFILE_PAGE_SIZE;

      return {
        items: sortedProfiles.slice(
          pageStart,
          pageStart + PUBLIC_PROFILE_PAGE_SIZE
        ),
        total,
        page: resolvedPage,
        limit: PUBLIC_PROFILE_PAGE_SIZE,
        totalPages,
      };
    },

    async getPublicProfileById(userId) {
      const normalizedUserId = String(userId || "").trim();
      if (!isValidObjectId(normalizedUserId)) return null;

      const user = await findProfileById(normalizedUserId);
      return user ? serializePublicProfile(user) : null;
    },

    async getCurrentUserProfile(identity) {
      const user = await findProfileByIdentity(identity);
      return user ? serializeCurrentProfile(user) : null;
    },
  };
}

const socialProfileUserService = createSocialProfileUserService({
  findPublicUsers,
  findPublicUserById,
  findUserByIdentity,
  getPublicExplorationSummaries,
  countPublicReviewsByUserIds,
});

export async function getPublicProfiles(options) {
  return socialProfileUserService.getPublicProfiles(options);
}

export async function getPublicProfileById(userId) {
  return socialProfileUserService.getPublicProfileById(userId);
}

export async function getCurrentUserProfile(identity) {
  return socialProfileUserService.getCurrentUserProfile(identity);
}

/**
 * 取得指定用户的公开 Social Profile。
 *
 * Service 负责：
 * - 验证 user ID
 * - 调用 repository
 * - 处理 user-not-found
 * - 建立安全且固定的 public response
 */
export async function getPublicUserProfile(userId) {
  const normalizedUserId = String(userId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return {
      status: "not_found",
      data: null,
    };
  }

  const user = await findPublicUserById(normalizedUserId);

  if (!user) {
    return {
      status: "not_found",
      data: null,
    };
  }

  return {
    status: "success",
    data: {
      id: user._id.toString(),
      name: user.name,
      profilePicture: user.profilePicture || "",
      publicSummary: user.publicSummary || "",
    },
  };

  // TODO: Add a confirmed public travel activity summary when
  // the Exploration Map and Review modules provide the required data.

  // TODO: Apply Registered User access control when Google authentication
  // and application sessions are implemented.
}
