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

export async function upsertUserByGoogleId({
  googleId,
  name,
  email,
  profilePicture,
  displayName,
  bio,
  location,
}) {
  return User.findOneAndUpdate(
    { googleId },
    {
      $set: { name },
      $setOnInsert: {
        email,
        profilePicture,
        googleId,
        displayName,
        bio,
        location,
      },
    },
    { upsert: true, new: true, runValidators: true }
  )
    .select("_id googleId")
    .lean();
}
