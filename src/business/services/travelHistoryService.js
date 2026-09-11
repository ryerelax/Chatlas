import {
  findTravelHistoryAttractionDetails,
  findTravelHistoryAttractionSummaries,
  findTravelHistoryReviewsForAttractions,
  findTravelHistoryReviewSummaries,
  findTravelHistoryVerifiedVisitSummaries,
} from "@/data/repositories/travelHistoryRepository";
import { findUserByIdentity } from "@/data/repositories/userRepository";

export const TRAVEL_HISTORY_PAGE_SIZE = 8;
const MAX_SEARCH_LENGTH = 100;

export class TravelHistoryServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "TravelHistoryServiceError";
    this.statusCode = statusCode;
  }
}

function normalizePage(value) {
  const page = Math.trunc(Number(value) || 1);
  return Math.max(1, page);
}

function normalizeSearch(value) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_SEARCH_LENGTH).toLocaleLowerCase()
    : "";
}

function normalizeSort(value) {
  return value === "oldest" ? "oldest" : "newest";
}

function getId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function serializeReview(review) {
  return {
    id: getId(review),
    rating: Number(review.rating) || 0,
    text: review.reviewText || "",
    date: review.createdAt || null,
    userName: review.userName || "Anonymous",
    userAvatar: review.userAvatar || "",
    photos: Array.isArray(review.photos)
      ? review.photos.map((photo) => ({
          url: photo?.url || "",
          publicId: photo?.publicId || "",
        }))
      : [],
  };
}

export function createTravelHistoryService({
  findUser = findUserByIdentity,
  findReviewSummaries = findTravelHistoryReviewSummaries,
  findVerifiedVisitSummaries = findTravelHistoryVerifiedVisitSummaries,
  findAttractionSummaries = findTravelHistoryAttractionSummaries,
  findAttractionDetails = findTravelHistoryAttractionDetails,
  findReviewsForAttractions = findTravelHistoryReviewsForAttractions,
} = {}) {
  return async function getTravelHistory({
    identity = {},
    page = 1,
    search = "",
    sort = "newest",
  } = {}) {
    const user = await findUser(identity);
    if (!user?._id) {
      throw new TravelHistoryServiceError("User account not found.", 404);
    }

    const [reviewSummaries, verifiedVisitSummaries] = await Promise.all([
      findReviewSummaries(user._id),
      findVerifiedVisitSummaries(user._id),
    ]);

    const activityByAttractionId = new Map();

    for (const summary of reviewSummaries || []) {
      const attractionId = getId(summary?._id);
      if (!attractionId) continue;
      activityByAttractionId.set(attractionId, {
        attractionId,
        firstReviewDate: summary.firstReviewDate || null,
        lastReviewDate: summary.lastReviewDate || null,
        hasReviews: true,
        latestVerifiedAt: null,
        latestVisitedDate: null,
      });
    }

    for (const summary of verifiedVisitSummaries || []) {
      const attractionId = getId(summary?._id);
      if (!attractionId) continue;
      const activity = activityByAttractionId.get(attractionId) || {
        attractionId,
        firstReviewDate: null,
        lastReviewDate: null,
        hasReviews: false,
      };
      activity.latestVerifiedAt = summary.latestVerifiedAt || null;
      activity.latestVisitedDate = summary.latestVisitedDate || null;
      activityByAttractionId.set(attractionId, activity);
    }

    const attractionIds = [...activityByAttractionId.keys()];
    const attractionSummaries = await findAttractionSummaries(attractionIds);
    const requestedSearch = normalizeSearch(search);
    const requestedSort = normalizeSort(sort);

    const matchingActivities = (attractionSummaries || [])
      .flatMap((attraction) => {
        const attractionId = getId(attraction);
        const activity = activityByAttractionId.get(attractionId);
        if (!activity) return [];
        if (
          !activity.hasReviews &&
          (attraction.state !== "Melaka" || attraction.isActive !== true)
        ) {
          return [];
        }

        const name = attraction.name || "Unknown attraction";
        const category = attraction.category || "Uncategorized";
        if (
          requestedSearch &&
          !name.toLocaleLowerCase().includes(requestedSearch) &&
          !category.toLocaleLowerCase().includes(requestedSearch)
        ) {
          return [];
        }

        return [{ ...activity, name, category }];
      })
      .sort((first, second) => {
        const firstDate = getTimestamp(
          first.latestVerifiedAt || first.lastReviewDate
        );
        const secondDate = getTimestamp(
          second.latestVerifiedAt || second.lastReviewDate
        );
        const dateOrder =
          requestedSort === "oldest"
            ? firstDate - secondDate
            : secondDate - firstDate;
        return (
          dateOrder ||
          first.name.localeCompare(second.name) ||
          first.attractionId.localeCompare(second.attractionId)
        );
      });

    const total = matchingActivities.length;
    const totalPages = Math.max(
      1,
      Math.ceil(total / TRAVEL_HISTORY_PAGE_SIZE)
    );
    const resolvedPage = Math.min(normalizePage(page), totalPages);
    const pageActivities = matchingActivities.slice(
      (resolvedPage - 1) * TRAVEL_HISTORY_PAGE_SIZE,
      resolvedPage * TRAVEL_HISTORY_PAGE_SIZE
    );
    const pageAttractionIds = pageActivities.map(
      (activity) => activity.attractionId
    );
    const [attractionDetails, reviews] = await Promise.all([
      findAttractionDetails(pageAttractionIds),
      findReviewsForAttractions(user._id, pageAttractionIds),
    ]);

    const detailById = new Map(
      (attractionDetails || []).map((attraction) => [getId(attraction), attraction])
    );
    const reviewsByAttractionId = new Map();
    for (const review of reviews || []) {
      const attractionId = getId(review.attractionId);
      if (!reviewsByAttractionId.has(attractionId)) {
        reviewsByAttractionId.set(attractionId, []);
      }
      reviewsByAttractionId.get(attractionId).push(serializeReview(review));
    }

    const items = pageActivities.map((activity) => {
      const attraction = detailById.get(activity.attractionId) || {};
      return {
        id: activity.attractionId,
        name: attraction.name || activity.name,
        category: attraction.category || activity.category,
        photos: Array.isArray(attraction.photos) ? attraction.photos : [],
        address: attraction.address || "",
        rating: Number(attraction.rating) || 0,
        description: attraction.description || "",
        reviews: reviewsByAttractionId.get(activity.attractionId) || [],
        visitedDate:
          activity.latestVerifiedAt || activity.lastReviewDate || null,
        firstReviewDate: activity.firstReviewDate,
        lastReviewDate: activity.lastReviewDate,
        latestVerifiedAt: activity.latestVerifiedAt,
        latestVisitedDate: activity.latestVisitedDate,
      };
    });

    const visibleAttractionIds = new Set(
      (attractionSummaries || []).map((attraction) => getId(attraction))
    );
    const totalReviews = (reviewSummaries || []).reduce(
      (sum, summary) =>
        visibleAttractionIds.has(getId(summary?._id))
          ? sum + (Number(summary.reviewCount) || 0)
          : sum,
      0
    );
    const totalPhotos = (reviewSummaries || []).reduce(
      (sum, summary) =>
        visibleAttractionIds.has(getId(summary?._id))
          ? sum + (Number(summary.photoCount) || 0)
          : sum,
      0
    );

    return {
      items,
      stats: {
        placesVisited: (verifiedVisitSummaries || []).length,
        reviewsWritten: totalReviews,
        photosUploaded: totalPhotos,
      },
      pagination: {
        page: resolvedPage,
        limit: TRAVEL_HISTORY_PAGE_SIZE,
        total,
        totalPages,
      },
    };
  };
}

export const getTravelHistory = createTravelHistoryService();
