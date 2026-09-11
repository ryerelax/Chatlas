import Attraction from "@/data/models/Attraction";
import Review from "@/data/models/Review";
import VerifiedVisit from "@/data/models/VerifiedVisit";

const ATTRACTION_SUMMARY_FIELDS = "_id name category state isActive";
const ATTRACTION_DETAIL_FIELDS =
  "_id name category photos address rating description";
const REVIEW_FIELDS =
  "_id attractionId rating reviewText userName userAvatar photos createdAt";

export function createTravelHistoryRepository({
  AttractionModel,
  ReviewModel,
  VerifiedVisitModel,
}) {
  return {
    async findReviewSummaries(userId) {
      return ReviewModel.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: "$attractionId",
            firstReviewDate: { $min: "$createdAt" },
            lastReviewDate: { $max: "$createdAt" },
            reviewCount: { $sum: 1 },
            photoCount: { $sum: { $size: { $ifNull: ["$photos", []] } } },
          },
        },
      ]);
    },

    async findVerifiedVisitSummaries(userId) {
      return VerifiedVisitModel.aggregate([
        { $match: { userId, "photos.0": { $exists: true } } },
        {
          $group: {
            _id: "$attractionId",
            latestVisitedDate: { $max: "$visitDateKey" },
            latestVerifiedAt: { $max: "$createdAt" },
          },
        },
      ]);
    },

    async findAttractionSummaries(attractionIds) {
      if (attractionIds.length === 0) return [];
      return AttractionModel.find({ _id: { $in: attractionIds } })
        .select(ATTRACTION_SUMMARY_FIELDS)
        .lean();
    },

    async findAttractionDetails(attractionIds) {
      if (attractionIds.length === 0) return [];
      return AttractionModel.find({ _id: { $in: attractionIds } })
        .select(ATTRACTION_DETAIL_FIELDS)
        .lean();
    },

    async findReviewsForAttractions(userId, attractionIds) {
      if (attractionIds.length === 0) return [];
      return ReviewModel.find({
        userId,
        attractionId: { $in: attractionIds },
      })
        .select(REVIEW_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .lean();
    },
  };
}

const travelHistoryRepository = createTravelHistoryRepository({
  AttractionModel: Attraction,
  ReviewModel: Review,
  VerifiedVisitModel: VerifiedVisit,
});

export const findTravelHistoryReviewSummaries = (userId) =>
  travelHistoryRepository.findReviewSummaries(userId);

export const findTravelHistoryVerifiedVisitSummaries = (userId) =>
  travelHistoryRepository.findVerifiedVisitSummaries(userId);

export const findTravelHistoryAttractionSummaries = (attractionIds) =>
  travelHistoryRepository.findAttractionSummaries(attractionIds);

export const findTravelHistoryAttractionDetails = (attractionIds) =>
  travelHistoryRepository.findAttractionDetails(attractionIds);

export const findTravelHistoryReviewsForAttractions = (userId, attractionIds) =>
  travelHistoryRepository.findReviewsForAttractions(userId, attractionIds);
