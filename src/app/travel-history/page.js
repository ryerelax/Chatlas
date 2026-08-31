"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import ExplorationMap from "@/presentation/components/ExplorationMap";
import { loadVisitedAttractionIds } from "@/presentation/lib/visitedAttractionsAdapter";

export default function TravelHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, translateCategory } = useLanguage();
  const { reviews, loadReviews } = useReviews();
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [visitedCount, setVisitedCount] = useState(0);
  const [visitedAttractionIds, setVisitedAttractionIds] = useState([]);
  const [latestVerifiedAtByAttractionId, setLatestVerifiedAtByAttractionId] =
    useState({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/travel-history");
      return;
    }

    if (status === "authenticated") {
      loadReviews(true);
    }
  }, [status, router, loadReviews]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const controller = new AbortController();

    async function loadVisitedCount() {
      try {
        const result = await loadVisitedAttractionIds({
          signal: controller.signal,
        });
        if (!controller.signal.aborted && result.status === "success") {
          setVisitedCount(result.data.length);
          setVisitedAttractionIds(result.data);
          setLatestVerifiedAtByAttractionId(
            result.latestVerifiedAtByAttractionId || {}
          );
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Failed to load visited attraction count:", error);
        }
      }
    }

    loadVisitedCount();
    return () => controller.abort();
  }, [status]);

  useEffect(() => {
    buildActivities();
  }, [reviews, visitedAttractionIds, latestVerifiedAtByAttractionId]);

  useEffect(() => {
    applyFilters();
  }, [activities, searchQuery, sortNewest]);

  const buildActivities = async () => {
    setIsLoading(true);
    try {
      const activityMap = new Map();

      const reviewItems = Array.isArray(reviews) ? reviews : [];

      const attractionIds = new Set(visitedAttractionIds);
      reviewItems.forEach((review) => {
        const id = review.attractionId?._id || review.attractionId;
        if (id) attractionIds.add(String(id));
      });

      const attractionDetails = {};
      for (const id of attractionIds) {
        try {
          const response = await fetch(`/api/attractions/${id}`);
          const data = await response.json();
          if (data.success) {
            attractionDetails[id] = data.data;
          }
        } catch (err) {
          console.error(`Failed to fetch attraction ${id}:`, err);
        }
      }

      reviewItems.forEach((review) => {
        if (!review) return;

        const rawAttractionId = review.attractionId?._id || review.attractionId;
        if (!rawAttractionId) return;

        const attractionId = String(rawAttractionId);
        const attractionData =
          attractionDetails[attractionId] || review.attractionId || {};

        const attractionName =
          attractionData.name ||
          review.attractionId?.name ||
          "Unknown attraction";
        const attractionCategory =
          attractionData.category ||
          review.attractionId?.category ||
          "Uncategorized";
        const attractionPhotos =
          attractionData.photos || review.attractionId?.photos || [];
        const attractionAddress =
          attractionData.address || review.attractionId?.address || "";
        const attractionRating =
          attractionData.rating || review.attractionId?.rating || 0;
        const attractionDescription =
          attractionData.description ||
          review.attractionId?.description ||
          "";

        if (!activityMap.has(attractionId)) {
          activityMap.set(attractionId, {
            id: attractionId,
            name: attractionName,
            category: attractionCategory,
            photos: attractionPhotos,
            address: attractionAddress,
            rating: attractionRating,
            description: attractionDescription,
            reviews: [],
            visitedDate: null,
            firstReviewDate: null,
            lastReviewDate: null,
          });
        }

        const entry = activityMap.get(attractionId);

        const reviewPhotos = [];
        if (
          review.photos &&
          Array.isArray(review.photos) &&
          review.photos.length > 0
        ) {
          review.photos.forEach((photo) => {
            if (photo) {
              reviewPhotos.push({
                url: photo.url || "",
                publicId: photo.publicId || "",
              });
            }
          });
        }

        entry.reviews.push({
          id: review._id,
          rating: review.rating || 0,
          text: review.reviewText || "",
          date: review.createdAt || new Date(),
          userName: review.userName || "Anonymous",
          userAvatar: review.userAvatar || "",
          photos: reviewPhotos,
        });

        const reviewDate = review.createdAt
          ? new Date(review.createdAt)
          : new Date();
        if (
          !entry.firstReviewDate ||
          reviewDate < new Date(entry.firstReviewDate)
        ) {
          entry.firstReviewDate = review.createdAt || new Date();
        }
        if (
          !entry.lastReviewDate ||
          reviewDate > new Date(entry.lastReviewDate)
        ) {
          entry.lastReviewDate = review.createdAt || new Date();
        }
        if (!entry.visitedDate || reviewDate > new Date(entry.visitedDate)) {
          entry.visitedDate = review.createdAt || new Date();
        }
      });

      visitedAttractionIds.forEach((attractionId) => {
        if (activityMap.has(attractionId)) return;

        const attractionData = attractionDetails[attractionId];
        if (!attractionData) return;

        activityMap.set(attractionId, {
          id: attractionId,
          name: attractionData.name || "Unknown attraction",
          category: attractionData.category || "Uncategorized",
          photos: attractionData.photos || [],
          address: attractionData.address || "",
          rating: attractionData.rating || 0,
          description: attractionData.description || "",
          reviews: [],
          visitedDate: latestVerifiedAtByAttractionId[attractionId] || null,
          firstReviewDate: null,
          lastReviewDate: null,
        });
      });

      for (const entry of activityMap.values()) {
        entry.reviews.sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        });
      }

      const activityArray = Array.from(activityMap.values());

      activityArray.sort((a, b) => {
        const dateA =
          latestVerifiedAtByAttractionId[a.id] || a.lastReviewDate;
        const dateB =
          latestVerifiedAtByAttractionId[b.id] || b.lastReviewDate;
        const normalizedDateA = dateA ? new Date(dateA) : new Date(0);
        const normalizedDateB = dateB ? new Date(dateB) : new Date(0);
        return normalizedDateB - normalizedDateA;
      });

      setActivities(activityArray);
    } catch (error) {
      console.error("Error building activities:", error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (activity) =>
          (activity.name || "").toLowerCase().includes(query) ||
          (activity.category || "").toLowerCase().includes(query)
      );
    }

    if (!sortNewest) {
      filtered.reverse();
    }

    setFilteredActivities(filtered);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const getReviewCount = (reviewsList) => {
    return reviewsList ? reviewsList.length : 0;
  };

  const getTotalPhotos = (reviewsList) => {
    if (!reviewsList) return 0;
    return reviewsList.reduce(
      (sum, review) => sum + (review.photos ? review.photos.length : 0),
      0
    );
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[#65748A]">{t("loading")}</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalAttractions = visitedCount;
  const totalReviews = activities
    ? activities.reduce(
        (sum, a) => sum + (a.reviews ? a.reviews.length : 0),
        0
      )
    : 0;
  const totalPhotos = activities
    ? activities.reduce((sum, a) => sum + getTotalPhotos(a.reviews), 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      <div className="bg-[#006C56] px-4 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.push("/profile")}
            className="mb-4 flex items-center gap-2 text-white/80 transition-colors hover:text-white"
          >
            ← {t("backToProfile")}
          </button>
          <h1 className="text-3xl font-bold md:text-4xl">
            {t("travelHistoryTitle")}
          </h1>
          <p className="mt-2 text-white/80">{t("exploreProgress")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-[14px] border border-[#D8E1E7] bg-white p-5 text-center">
            <p className="text-3xl font-bold tracking-tight text-[#10213B]">
              {totalAttractions}
            </p>
            <p className="mt-1 text-sm text-[#65748A]">{t("placesVisited")}</p>
          </div>
          <div className="rounded-[14px] border border-[#D8E1E7] bg-white p-5 text-center">
            <p className="text-3xl font-bold tracking-tight text-[#10213B]">
              {totalReviews}
            </p>
            <p className="mt-1 text-sm text-[#65748A]">{t("reviewsWritten")}</p>
          </div>
          <div className="rounded-[14px] border border-[#D8E1E7] bg-white p-5 text-center">
            <p className="text-3xl font-bold tracking-tight text-[#10213B]">
              {totalPhotos}
            </p>
            <p className="mt-1 text-sm text-[#65748A]">{t("photosUploaded")}</p>
          </div>
        </div>

        <div className="mb-8">
          <ExplorationMap mapOnly />
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-[#98A2B3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder={t("search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#D8E1E7] bg-white py-2 pl-10 pr-4 text-[#10213B] placeholder-[#98A2B3] transition-all focus:border-[#006C56] focus:outline-none focus:ring-2 focus:ring-[#006C56]/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transform text-[#98A2B3] hover:text-[#65748A]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="text-sm text-[#65748A]">{t("sortBy")}:</span>
            <select
              value={sortNewest ? "newest" : "oldest"}
              onChange={(e) => setSortNewest(e.target.value === "newest")}
              className="cursor-pointer rounded-lg border border-[#D8E1E7] bg-white px-3 py-2 text-sm text-[#10213B] outline-none focus:border-[#006C56]"
            >
              <option value="newest">{t("sortNewest")}</option>
              <option value="oldest">{t("sortOldest")}</option>
            </select>
          </div>
        </div>

        {!filteredActivities || filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold text-[#10213B]">
              {searchQuery ? t("noAttractionsFound") : t("emptyHistory")}
            </h3>
            <p className="mt-2 text-[#65748A]">
              {searchQuery ? t("tryChangingFilters") : t("emptyHistory")}
            </p>
            <button
              onClick={() =>
                searchQuery ? setSearchQuery("") : router.push("/")
              }
              className="mt-6 rounded-lg bg-[#FFAB00] px-6 py-2 font-semibold text-[#142033] transition-colors hover:bg-[#E89B00]"
            >
              {searchQuery ? t("clearSearchAndFilters") : t("browseAttractions")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => {
              const isExpanded = expandedId === activity.id;
              const coverPhoto =
                activity.photos && activity.photos.length > 0
                  ? activity.photos[0]
                  : null;
              const reviewCount = getReviewCount(activity.reviews);
              const totalPhotosForActivity = getTotalPhotos(activity.reviews);
              const latestReview =
                activity.reviews && activity.reviews.length > 0
                  ? activity.reviews[0]
                  : null;

              return (
                <div
                  key={activity.id}
                  className="overflow-hidden rounded-[18px] border border-[#D8E1E7] bg-white transition-shadow hover:shadow-lg"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="relative h-48 w-full flex-shrink-0 bg-[#CDF5E5] md:h-auto md:w-56">
                      {coverPhoto ? (
                        <Image
                          src={coverPhoto}
                          alt={activity.name || "Attraction"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 224px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl text-[#006C56]/30">
                          📍
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-[#10213B]">
                            {activity.name || "—"}
                          </h3>
                          <span className="mt-1 inline-block rounded-full border border-[#A7D7C5] bg-[#E6F7F0] px-2 py-0.5 text-xs text-[#004638]">
                            {activity.category
                              ? translateCategory
                                ? translateCategory(activity.category)
                                : activity.category
                              : "—"}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#65748A]">
                            {latestVerifiedAtByAttractionId[activity.id]
                              ? formatDate(
                                  latestVerifiedAtByAttractionId[activity.id]
                                )
                              : formatDate(activity.lastReviewDate)}
                          </p>
                        </div>
                      </div>

                      {activity.address && (
                        <p className="mt-2 text-sm text-[#65748A]">
                          📍 {activity.address}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <span className="text-[#FFAB00]">★</span>
                          <span className="font-medium text-[#10213B]">
                            {activity.rating
                              ? Number(activity.rating).toFixed(1)
                              : "N/A"}
                          </span>
                        </div>
                        <span className="text-sm text-[#65748A]">
                          {reviewCount} {t("reviews")}
                        </span>
                        {totalPhotosForActivity > 0 && (
                          <span className="text-sm text-[#65748A]">
                            • {totalPhotosForActivity} {t("photos")}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => toggleExpand(activity.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-[#D8E1E7] bg-[#F7F9FB] px-4 py-2 text-sm font-medium text-[#10213B] transition-colors hover:bg-[#EAF3FA]"
                        >
                          {isExpanded ? t("hideFilters") : t("details")}
                          <svg
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        {latestReview && latestReview.text && (
                          <span className="text-sm text-[#65748A]">
                            {latestReview.text.substring(0, 30)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#D8E1E7] bg-[#F7F9FB] p-6">
                      {activity.description && (
                        <div className="mb-6 border-b border-[#D8E1E7] pb-6">
                          <h4 className="mb-2 flex items-center gap-2 text-base font-semibold text-[#10213B]">
                            {t("description")}
                          </h4>
                          <p className="text-sm leading-relaxed text-[#405066]">
                            {activity.description}
                          </p>
                        </div>
                      )}

                      {activity.reviews && activity.reviews.length > 0 && (
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#10213B]">
                            {t("reviews")} ({activity.reviews.length})
                          </h4>
                          <div className="space-y-4">
                            {activity.reviews.map((review, index) => (
                              <div
                                key={review.id || index}
                                className="rounded-[12px] border border-[#D8E1E7] bg-white p-4"
                              >
                                <div className="mb-2 flex items-center gap-3">
                                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#CDF5E5] text-xs font-semibold text-[#006C56]">
                                    {review.userAvatar ? (
                                      <Image
                                        src={review.userAvatar}
                                        alt={review.userName || "User"}
                                        width={32}
                                        height={32}
                                        className="object-cover"
                                      />
                                    ) : (
                                      (review.userName &&
                                        review.userName.charAt(0)) ||
                                      "U"
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-[#10213B]">
                                      {review.userName || "Anonymous"}
                                    </p>
                                    <p className="text-xs text-[#65748A]">
                                      {formatDate(review.date)}
                                    </p>
                                  </div>
                                  <div className="ml-auto flex items-center gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <span
                                        key={i}
                                        className={
                                          i < (review.rating || 0)
                                            ? "text-[#FFAB00]"
                                            : "text-[#D8E1E7]"
                                        }
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm leading-relaxed text-[#405066]">
                                  {review.text || ""}
                                </p>

                                {review.photos && review.photos.length > 0 && (
                                  <div className="mt-3 border-t border-[#D8E1E7] pt-3">
                                    <div className="flex flex-wrap gap-2">
                                      {review.photos
                                        .slice(0, 6)
                                        .map((photo, idx) => (
                                          <div
                                            key={photo.publicId || idx}
                                            className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border border-[#D8E1E7] bg-[#CDF5E5] transition-transform hover:scale-105"
                                            onClick={() =>
                                              window.open(photo.url, "_blank")
                                            }
                                          >
                                            {photo.url ? (
                                              <Image
                                                src={photo.url}
                                                alt={`Photo ${idx + 1}`}
                                                fill
                                                className="object-cover"
                                                sizes="64px"
                                              />
                                            ) : (
                                              <div className="flex h-full items-center justify-center text-lg text-[#006C56]/30">
                                                📷
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
