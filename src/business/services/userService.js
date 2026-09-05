import mongoose from "mongoose";
import {
  findPublicUserById,
  findPublicUsers,
  findUserByIdentity,
} from "@/data/repositories/userRepository";

const PUBLIC_PROFILE_PAGE_SIZE = 12;
const MAX_SEARCH_LENGTH = 80;

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  isValidObjectId = mongoose.Types.ObjectId.isValid,
}) {
  return {
    async getPublicProfiles({
      search = "",
      page = 1,
      excludedGoogleId = "",
    } = {}) {
      const normalizedSearch = String(search)
        .trim()
        .slice(0, MAX_SEARCH_LENGTH);
      const normalizedPage = Math.max(1, Math.trunc(Number(page) || 1));
      const searchPattern = normalizedSearch
        ? escapeRegularExpression(normalizedSearch)
        : "";

      const { items, total } = await findProfiles({
        searchPattern,
        excludedGoogleId,
        page: normalizedPage,
        limit: PUBLIC_PROFILE_PAGE_SIZE,
      });

      return {
        items: items.map(serializePublicProfile),
        total,
        page: normalizedPage,
        limit: PUBLIC_PROFILE_PAGE_SIZE,
        totalPages: Math.max(
          1,
          Math.ceil(total / PUBLIC_PROFILE_PAGE_SIZE)
        ),
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
