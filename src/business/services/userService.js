import mongoose from "mongoose";
import {
  createUser,
  findPublicUserById,
  findPublicUsers,
  findUserByEmail,
  findUserByGoogleId,
  findUserByIdentity,
  updateGoogleNameByEmail,
  updateUserProfileByIdentity,
} from "@/data/repositories/userRepository";

const PUBLIC_PROFILE_PAGE_SIZE = 12;
const MAX_SEARCH_LENGTH = 80;

export class UserValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserValidationError";
  }
}

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

function normalizeOptionalText(value, fieldName, maxLength) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new UserValidationError(`${fieldName} must be text.`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length > maxLength) {
    throw new UserValidationError(
      `${fieldName} must be ${maxLength} characters or fewer.`
    );
  }

  return normalizedValue;
}

function normalizeProfilePicture(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new UserValidationError("Profile picture must be a URL.");
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) return "";

  let profilePictureUrl;
  try {
    profilePictureUrl = new URL(normalizedValue);
  } catch {
    throw new UserValidationError("Profile picture must be a valid URL.");
  }

  if (profilePictureUrl.protocol !== "https:") {
    throw new UserValidationError("Profile picture must use HTTPS.");
  }

  return profilePictureUrl.toString();
}

function serializePrivateProfile(user) {
  const joinedAt = user.joinedAt || user.createdAt || null;

  return {
    id: String(user._id),
    displayName: user.displayName || "",
    name: user.name,
    email: user.email,
    profilePicture: user.profilePicture || "",
    bio: user.bio || "",
    location: user.location || "",
    joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
  };
}

export async function getPublicProfiles({
  search = "",
  page = 1,
  excludedGoogleId = "",
} = {}) {
  const normalizedSearch = String(search).trim().slice(0, MAX_SEARCH_LENGTH);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const searchPattern = normalizedSearch
    ? escapeRegularExpression(normalizedSearch)
    : "";

  const { items, total } = await findPublicUsers({
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
    totalPages: Math.max(1, Math.ceil(total / PUBLIC_PROFILE_PAGE_SIZE)),
  };
}

export async function getPublicProfileById(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  const user = await findPublicUserById(userId);
  return user ? serializePublicProfile(user) : null;
}

export async function getCurrentUserProfile(identity) {
  const user = await findUserByIdentity(identity);
  return user ? serializePrivateProfile(user) : null;
}

export async function updateCurrentUserProfile(identity, profileData) {
  if (!profileData || typeof profileData !== "object" || Array.isArray(profileData)) {
    throw new UserValidationError("Profile data must be a JSON object.");
  }

  const displayName = normalizeOptionalText(
    profileData.displayName,
    "Display name",
    50
  );
  const bio = normalizeOptionalText(profileData.bio, "Bio", 200);
  const location = normalizeOptionalText(profileData.location, "Location", 100);
  const profilePicture = normalizeProfilePicture(profileData.profilePicture);

  if (displayName !== undefined && !displayName) {
    throw new UserValidationError("Display name is required.");
  }

  const updateFields = {};
  if (displayName !== undefined) updateFields.displayName = displayName;
  if (bio !== undefined) updateFields.bio = bio;
  if (location !== undefined) updateFields.location = location;
  if (profilePicture !== undefined) updateFields.profilePicture = profilePicture;

  const user = await updateUserProfileByIdentity(identity, updateFields);
  return user ? serializePrivateProfile(user) : null;
}

export async function provisionGoogleUser({ name, email, image, googleId }) {
  if (!email || !googleId) {
    throw new UserValidationError("Google account identity is incomplete.");
  }

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    await updateGoogleNameByEmail(email, name || existingUser.name);
    return;
  }

  await createUser({
    name: name || "Chatlas traveller",
    email,
    profilePicture: image || "",
    googleId,
    displayName: name || "",
    bio: "",
    location: "",
  });
}

export async function getSessionUserProfile(googleId) {
  const user = await findUserByGoogleId(googleId);

  if (!user) return null;

  return {
    image: user.profilePicture || "",
    name: user.displayName || user.name,
    displayName: user.displayName || user.name,
    bio: user.bio || "",
    location: user.location || "",
  };
}
