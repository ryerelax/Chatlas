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

const VALID_SORTS = new Set(["name", "newest", "rating", "mostReviewed"]);

// "rating"/"mostReviewed" compare combinedRating/review-count totals, which
// only exist once withRatingBreakdown has run below - so these can't be
// pushed down to findAttractions's MongoDB sort like "name"/"newest" are.
const POST_JOIN_SORT_COMPARATORS = {
  rating: (a, b) => b.combinedRating - a.combinedRating,
  mostReviewed: (a, b) =>
    b.chatlasReviewCount + b.googleReviewCount - (a.chatlasReviewCount + a.googleReviewCount),
};

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
  sort = "name",
}) {
  const normalizedSearch = search.trim();
  const normalizedCategory = category.trim();
  const normalizedLocationArea = locationArea.trim();
  const normalizedMinRating = Number(minRating) || 0;
  const normalizedCommunitySubmitted =
    communitySubmitted === true || communitySubmitted === "true";
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedSort = VALID_SORTS.has(sort) ? sort : "name";
  const postJoinComparator = POST_JOIN_SORT_COMPARATORS[normalizedSort];
  const needsMinRatingFilter = normalizedMinRating > 0;
  // combinedRating only exists once the review-stats join below has run, so
  // filtering by it (like sorting by it) can't be pushed down to MongoDB -
  // fetch every otherwise-matching attraction unpaginated and filter/sort/
  // slice here instead.
  const needsPostJoinProcessing = Boolean(postJoinComparator) || needsMinRatingFilter;

  const { items, total: unfilteredTotal } = await findAttractions({
    search: normalizedSearch,
    category: normalizedCategory,
    locationArea: normalizedLocationArea,
    communitySubmitted: normalizedCommunitySubmitted,
    page: normalizedPage,
    limit: PAGE_SIZE,
    sort: normalizedSort,
    paginate: !needsPostJoinProcessing,
  });

  const statsByAttractionId = await getReviewStatsForAttractions(
    items.map((item) => item._id)
  );

  let itemsWithRating = items.map((item) =>
    withRatingBreakdown(item, statsByAttractionId.get(item._id.toString()))
  );

  if (needsMinRatingFilter) {
    itemsWithRating = itemsWithRating.filter(
      (item) => item.combinedRating >= normalizedMinRating
    );
  }

  let total = unfilteredTotal;

  if (needsPostJoinProcessing) {
    if (postJoinComparator) {
      itemsWithRating = itemsWithRating.sort(postJoinComparator);
    }

    total = itemsWithRating.length;
    const start = (normalizedPage - 1) * PAGE_SIZE;
    itemsWithRating = itemsWithRating.slice(start, start + PAGE_SIZE);
  }

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

  const attraction = await findAttractionById(attractionId);

  if (!attraction) {
    return null;
  }

  const chatlasStats = await getReviewStatsForAttraction(attractionId);

  return withRatingBreakdown(attraction, chatlasStats);
}