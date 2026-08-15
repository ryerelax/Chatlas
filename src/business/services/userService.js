import mongoose from "mongoose";
import { findPublicUserById } from "@/data/repositories/userRepository";

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