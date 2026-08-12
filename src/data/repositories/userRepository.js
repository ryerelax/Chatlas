import User from "@/data/models/User";

export async function findUserByGoogleId(googleId) {
  return User.findOne({ googleId })
    .select("_id name displayName profilePicture")
    .lean();
}
