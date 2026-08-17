import User from "@/data/models/User";

export async function findUserByGoogleId(googleId) {
  return User.findOne({ googleId })
    .select("_id name displayName profilePicture bio location")
    .lean();
}

export async function findUserByEmail(email) {
  return User.findOne({ email })
    .select("_id name displayName profilePicture")
    .lean();
}

export async function findGoogleIdentityByEmail(email) {
  return User.findOne({ email })
    .select("googleId")
    .lean();
}

export async function createUser(user) {
  return User.create(user);
}

export async function updateUserByGoogleId(googleId, updates) {
  return User.updateOne({ googleId }, updates);
}
