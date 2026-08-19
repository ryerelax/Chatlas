import User from "@/data/models/User";

const PUBLIC_PROFILE_FIELDS =
  "_id name displayName profilePicture bio location joinedAt createdAt";

export function createPublicUserRepository({ UserModel }) {
  return {
    async findPublicUsers({
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
        UserModel.find(query)
          .select(PUBLIC_PROFILE_FIELDS)
          .sort({ displayName: 1, name: 1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        UserModel.countDocuments(query),
      ]);

      return { items, total };
    },

    async findPublicUserById(userId) {
      return UserModel.findById(userId).select(PUBLIC_PROFILE_FIELDS).lean();
    },
  };
}

const publicUserRepository = createPublicUserRepository({ UserModel: User });

export async function findPublicUsers(options) {
  return publicUserRepository.findPublicUsers(options);
}

export async function findPublicUserById(userId) {
  return publicUserRepository.findPublicUserById(userId);
}

export async function findUserByIdentity({ googleId = "", email = "" } = {}) {
  const identities = [];

  if (googleId) identities.push({ googleId });
  if (email) identities.push({ email });

  if (identities.length === 0) return null;

  return User.findOne({ $or: identities }).lean();
}

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
