import User from "@/data/models/User";

<<<<<<< HEAD
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
=======
export async function findUserByGoogleId(googleId) {
  return User.findOne({ googleId })
    .select("_id name displayName profilePicture")
    .lean();
}

export async function findUserByEmail(email) {
  return User.findOne({ email })
    .select("_id name displayName profilePicture")
    .lean();
}
>>>>>>> ab63e4200c18ce0397a7763e461569142c828690
