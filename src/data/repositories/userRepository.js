import User from "@/data/models/User";

const PUBLIC_PROFILE_FIELDS =
  "_id name displayName profilePicture bio location joinedAt createdAt";

export async function findPublicUsers({
  searchPattern = "",
  excludedGoogleId = "",
  page = 1,
  limit = 12,
} = {}) {
  const query = {};

  if (searchPattern) {
    query.$or = [
      { displayName: { $regex: searchPattern, $options: "i" } },
      { name: { $regex: searchPattern, $options: "i" } },
      { location: { $regex: searchPattern, $options: "i" } },
    ];
  }

  if (excludedGoogleId) {
    query.googleId = { $ne: excludedGoogleId };
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(query)
      .select(PUBLIC_PROFILE_FIELDS)
      .sort({ displayName: 1, name: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return { items, total };
}

export async function findPublicUserById(userId) {
  return User.findById(userId).select(PUBLIC_PROFILE_FIELDS).lean();
}

export async function findUserByIdentity({ googleId = "", email = "" }) {
  const identities = [];

  if (googleId) identities.push({ googleId });
  if (email) identities.push({ email });

  if (identities.length === 0) return null;

  return User.findOne({ $or: identities });
}

export async function findUserByGoogleId(googleId) {
  if (!googleId) return null;
  return User.findOne({ googleId }).lean();
}

export async function findUserByEmail(email) {
  if (!email) return null;
  return User.findOne({ email });
}

export async function createUser(userData) {
  return User.create(userData);
}

export async function updateGoogleNameByEmail(email, name) {
  return User.updateOne({ email }, { $set: { name } });
}

export async function updateUserProfileByIdentity(identity, profileFields) {
  const user = await findUserByIdentity(identity);

  if (!user) return null;

  Object.assign(user, profileFields);
  await user.save();
  return user;
}
