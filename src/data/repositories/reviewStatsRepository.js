import mongoose from "mongoose";
import Review from "@/data/models/Review";

// Read-only aggregation over the shared Review collection, for Attraction
// Explorer's own combined-rating widget. Does not modify or depend on the
// Reviews module's own repository/service/components — just reads the model.

export async function getReviewStatsForAttraction(attractionId) {
  const [stats] = await Review.aggregate([
    { $match: { attractionId: new mongoose.Types.ObjectId(attractionId) } },
    { $group: { _id: null, count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
  ]);

  return stats ? { count: stats.count, avgRating: stats.avgRating } : { count: 0, avgRating: 0 };
}

// Bulk variant for list pages — one aggregate query instead of one per card.
export async function getReviewStatsForAttractions(attractionIds) {
  const objectIds = attractionIds.map((id) => new mongoose.Types.ObjectId(id));

  const results = await Review.aggregate([
    { $match: { attractionId: { $in: objectIds } } },
    { $group: { _id: "$attractionId", count: { $sum: 1 }, avgRating: { $avg: "$rating" } } },
  ]);

  const statsByAttractionId = new Map();
  for (const result of results) {
    statsByAttractionId.set(result._id.toString(), {
      count: result.count,
      avgRating: result.avgRating,
    });
  }

  return statsByAttractionId;
}
