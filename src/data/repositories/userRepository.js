import User from "@/data/models/User";

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
