import mongoose from "mongoose";
import VerifiedVisit from "@/data/models/VerifiedVisit";

export function createSocialProfileExplorationRepository({
  VerifiedVisitModel,
  toObjectId = (value) => new mongoose.Types.ObjectId(value),
}) {
  function normalizeObjectIds(values) {
    return [...new Set(values.map(String))].flatMap((value) => {
      try {
        return [toObjectId(value)];
      } catch {
        return [];
      }
    });
  }

  return {
    async findDistinctVerifiedAttractionCountsByUserIds(
      userIds = [],
      supportedAttractionIds = []
    ) {
      const normalizedUserIds = normalizeObjectIds(userIds);
      const normalizedAttractionIds = normalizeObjectIds(
        supportedAttractionIds
      );

      if (
        normalizedUserIds.length === 0 ||
        normalizedAttractionIds.length === 0
      ) {
        return [];
      }

      const records = await VerifiedVisitModel.aggregate([
        {
          $match: {
            userId: { $in: normalizedUserIds },
            attractionId: { $in: normalizedAttractionIds },
            "photos.0": { $exists: true },
          },
        },
        {
          $group: {
            _id: {
              userId: "$userId",
              attractionId: "$attractionId",
            },
          },
        },
        {
          $group: {
            _id: "$_id.userId",
            visitedCount: { $sum: 1 },
          },
        },
      ]);

      return records.flatMap((record) => {
        const userId = record?._id?.toString?.();
        const visitedCount = Number(record?.visitedCount);

        return userId && Number.isInteger(visitedCount) && visitedCount >= 0
          ? [{ userId, visitedCount }]
          : [];
      });
    },
  };
}

const socialProfileExplorationRepository =
  createSocialProfileExplorationRepository({ VerifiedVisitModel: VerifiedVisit });

export async function findDistinctVerifiedAttractionCountsByUserIds(
  userIds,
  supportedAttractionIds
) {
  return socialProfileExplorationRepository
    .findDistinctVerifiedAttractionCountsByUserIds(
      userIds,
      supportedAttractionIds
    );
}
