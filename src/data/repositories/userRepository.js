import User from "@/data/models/User";

/**
 * 根据 MongoDB ObjectId 读取一个公开用户资料。
 *
 * 这里只选择 public profile 允许公开的字段，
 * email、googleId 等 private fields 不会被查询或返回。
 */
export async function findPublicUserById(userId) {
  return User.findOne({
    _id: userId,
    isActive: true,
    isProfilePublic: true,
  })
    .select("_id name profilePicture publicSummary")
    .lean();
}