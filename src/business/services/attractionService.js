import mongoose from "mongoose";
import {
  findAttractions,
  findAttractionById,
} from "@/data/repositories/attractionRepository";
import {
  getReviewStatsForAttraction,
  getReviewStatsForAttractions,
} from "@/data/repositories/reviewStatsRepository";
import { computeCombinedRating } from "@/business/services/attractionRatingService";

const PAGE_SIZE = 15;

function withRatingBreakdown(attraction, chatlasStats) {
  const googleRating = attraction.rating || 0;
  const googleReviewCount = attraction.totalReviews || 0;
  const chatlasReviewCount = chatlasStats?.count || 0;
  const chatlasAvgRating = chatlasStats?.avgRating || 0;

  return {
    ...attraction,
    combinedRating: computeCombinedRating({
      googleRating,
      googleReviewCount,
      chatlasAvgRating,
      chatlasReviewCount,
    }),
    chatlasReviewCount,
    googleReviewCount,
  };
}

export async function getAttractions({
  search = "",
  category = "",
  locationArea = "",
  minRating = 0,
  communitySubmitted = false,
  page = 1,
}) {
  const normalizedSearch = search.trim();
  const normalizedCategory = category.trim();
  const normalizedLocationArea = locationArea.trim();
  const normalizedMinRating = Number(minRating) || 0;
  const normalizedCommunitySubmitted = communitySubmitted === true || communitySubmitted === "true";
  const normalizedPage = Math.max(1, Number(page) || 1);

  const { items, total } = await findAttractions({
    search: normalizedSearch,
    category: normalizedCategory,
    locationArea: normalizedLocationArea,
    minRating: normalizedMinRating,
    communitySubmitted: normalizedCommunitySubmitted,
    page: normalizedPage,
    limit: PAGE_SIZE,
  });

  const statsByAttractionId = await getReviewStatsForAttractions(
    items.map((item) => item._id)
  );

  const itemsWithRating = items.map((item) =>
    withRatingBreakdown(item, statsByAttractionId.get(item._id.toString()))
  );

  return {
    items: itemsWithRating,
    total,
    page: normalizedPage,
    limit: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getAttractionById(attractionId) {
  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    return null;
  }

  // TODO: Add extra business rules here if attraction visibility rules change.
  const attraction = await findAttractionById(attractionId);

  if (!attraction) {
    return null;
  }

  const chatlasStats = await getReviewStatsForAttraction(attractionId);

  return withRatingBreakdown(attraction, chatlasStats);
}