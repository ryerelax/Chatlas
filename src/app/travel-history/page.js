"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";

export default function TravelHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { reviews, loadReviews } = useReviews();
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

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
    if (reviews && reviews.length > 0) {
      buildActivities();
    } else if (reviews && reviews.length === 0) {
      setActivities([]);
      setIsLoading(false);
    }
  }, [reviews]);

  useEffect(() => {
    applyFilters();
  }, [activities, searchQuery, sortNewest]);

  const buildActivities = async () => {
    setIsLoading(true);
    try {
      const activityMap = new Map();

      if (!reviews || !Array.isArray(reviews)) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      const attractionIds = new Set();
      reviews.forEach((review) => {
        const id = review.attractionId?._id || review.attractionId;
        if (id) attractionIds.add(id);
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

      reviews.forEach((review) => {
        if (!review) return;

        const attractionId = review.attractionId?._id || review.attractionId;
        const attractionData = attractionDetails[attractionId] || review.attractionId || {};
        
        const attractionName = attractionData.name || review.attractionId?.name || "Unknown attraction";
        const attractionCategory = attractionData.category || review.attractionId?.category || "Uncategorized";
        const attractionPhotos = attractionData.photos || review.attractionId?.photos || [];
        const attractionAddress = attractionData.address || review.attractionId?.address || "";
        const attractionRating = attractionData.rating || review.attractionId?.rating || 0;
        const attractionDescription = attractionData.description || review.attractionId?.description || "No description available for this attraction.";

        if (!attractionId) return;

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
        if (review.photos && Array.isArray(review.photos) && review.photos.length > 0) {
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

        const reviewDate = review.createdAt ? new Date(review.createdAt) : new Date();
        if (!entry.firstReviewDate || reviewDate < new Date(entry.firstReviewDate)) {
          entry.firstReviewDate = review.createdAt || new Date();
        }
        if (!entry.lastReviewDate || reviewDate > new Date(entry.lastReviewDate)) {
          entry.lastReviewDate = review.createdAt || new Date();
        }
        if (!entry.visitedDate || reviewDate > new Date(entry.visitedDate)) {
          entry.visitedDate = review.createdAt || new Date();
        }
      });

      // Sort reviews by date for each activity (newest first)
      for (const entry of activityMap.values()) {
        entry.reviews.sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(0);
          const dateB = b.date ? new Date(b.date) : new Date(0);
          return dateB - dateA;
        });
      }

      const activityArray = Array.from(activityMap.values());
      
      activityArray.sort((a, b) => {
        const dateA = a.lastReviewDate ? new Date(a.lastReviewDate) : new Date(0);
        const dateB = b.lastReviewDate ? new Date(b.lastReviewDate) : new Date(0);
        return dateB - dateA;
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
      filtered = filtered.filter(activity => 
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

  const getReviewCount = (reviews) => {
    return reviews ? reviews.length : 0;
  };

  const getTotalPhotos = (reviews) => {
    if (!reviews) return 0;
    return reviews.reduce((sum, review) => sum + (review.photos ? review.photos.length : 0), 0);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your travel history...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalAttractions = activities ? activities.length : 0;
  const totalReviews = activities ? activities.reduce((sum, a) => sum + (a.reviews ? a.reviews.length : 0), 0) : 0;
  const totalPhotos = activities ? activities.reduce((sum, a) => sum + getTotalPhotos(a.reviews), 0) : 0;

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      <div className="bg-[#006C56] text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.push("/profile")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Profile
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Travel History</h1>
          <p className="text-white/80 mt-2">
            Explore your journey across Melaka
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#D8E1E7] rounded-[14px] p-5 text-center">
            <p className="text-[#10213B] font-bold text-3xl tracking-tight">{totalAttractions}</p>
            <p className="text-[#65748A] text-sm mt-1">Attractions visited</p>
          </div>
          <div className="bg-white border border-[#D8E1E7] rounded-[14px] p-5 text-center">
            <p className="text-[#10213B] font-bold text-3xl tracking-tight">{totalReviews}</p>
            <p className="text-[#65748A] text-sm mt-1">Reviews written</p>
          </div>
          <div className="bg-white border border-[#D8E1E7] rounded-[14px] p-5 text-center">
            <p className="text-[#10213B] font-bold text-3xl tracking-tight">{totalPhotos}</p>
            <p className="text-[#65748A] text-sm mt-1">Photos uploaded</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#98A2B3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by attraction name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#D8E1E7] rounded-lg text-[#10213B] placeholder-[#98A2B3] focus:outline-none focus:border-[#006C56] focus:ring-2 focus:ring-[#006C56]/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#98A2B3] hover:text-[#65748A]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-[#65748A]">Sort by:</span>
            <select
              value={sortNewest ? "newest" : "oldest"}
              onChange={(e) => setSortNewest(e.target.value === "newest")}
              className="border border-[#D8E1E7] text-[#10213B] bg-white rounded-lg px-3 py-2 text-sm outline-none cursor-pointer focus:border-[#006C56]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>

        {!filteredActivities || filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">
              {searchQuery ? "No matching attractions found" : "No travel history yet"}
            </h3>
            <p className="text-[#65748A] mt-2">
              {searchQuery 
                ? `No attractions match "${searchQuery}". Try a different search term.`
                : "You haven't explored any attractions yet. Start your journey today!"}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-[#FFAB00] text-[#142033] font-semibold rounded-lg hover:bg-[#E89B00] transition-colors"
            >
              {searchQuery ? "Clear search" : "Explore Attractions"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredActivities.map((activity) => {
              const isExpanded = expandedId === activity.id;
              const coverPhoto = activity.photos && activity.photos.length > 0 ? activity.photos[0] : null;
              const reviewCount = getReviewCount(activity.reviews);
              const totalPhotosForActivity = getTotalPhotos(activity.reviews);
              const latestReview = activity.reviews && activity.reviews.length > 0 ? activity.reviews[0] : null;

              return (
                <div
                  key={activity.id}
                  className="bg-white border border-[#D8E1E7] rounded-[18px] overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="relative w-full md:w-56 h-48 md:h-auto flex-shrink-0 bg-[#CDF5E5]">
                      {coverPhoto ? (
                        <Image
                          src={coverPhoto}
                          alt={activity.name || "Attraction"}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 224px"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-[#006C56]/30 text-4xl">
                          📍
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-[#10213B]">
                            {activity.name || "Unknown attraction"}
                          </h3>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-[#E6F7F0] text-[#004638] text-xs rounded-full border border-[#A7D7C5]">
                            {activity.category || "Uncategorized"}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#65748A]">
                            Last visited: {activity.lastReviewDate ? formatDate(activity.lastReviewDate) : "N/A"}
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
                            {activity.rating ? Number(activity.rating).toFixed(1) : "N/A"}
                          </span>
                        </div>
                        <span className="text-[#65748A] text-sm">
                          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                        </span>
                        {totalPhotosForActivity > 0 && (
                          <span className="text-[#65748A] text-sm">
                            • {totalPhotosForActivity} {totalPhotosForActivity === 1 ? "photo" : "photos"}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => toggleExpand(activity.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#F7F9FB] border border-[#D8E1E7] rounded-lg text-sm font-medium text-[#10213B] hover:bg-[#EAF3FA] transition-colors"
                        >
                          {isExpanded ? "Hide details" : "View details"}
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {latestReview && (
                          <span className="text-sm text-[#65748A]">
                            Latest: {latestReview.text?.substring(0, 30) || ""}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#D8E1E7] p-6 bg-[#F7F9FB]">
                      {activity.description && (
                        <div className="mb-6 pb-6 border-b border-[#D8E1E7]">
                          <h4 className="text-base font-semibold text-[#10213B] mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#006C56]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            About this attraction
                          </h4>
                          <p className="text-sm text-[#405066] leading-relaxed">
                            {activity.description}
                          </p>
                        </div>
                      )}

                      {activity.reviews && activity.reviews.length > 0 && (
                        <div>
                          <h4 className="text-base font-semibold text-[#10213B] mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2F6DA1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Reviews ({activity.reviews.length})
                          </h4>
                          <div className="space-y-4">
                            {activity.reviews.map((review, index) => (
                              <div key={review.id || index} className="bg-white border border-[#D8E1E7] rounded-[12px] p-4">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-8 h-8 rounded-full bg-[#CDF5E5] flex items-center justify-center text-[#006C56] font-semibold text-xs overflow-hidden">
                                    {review.userAvatar ? (
                                      <Image src={review.userAvatar} alt={review.userName || "User"} width={32} height={32} className="object-cover" />
                                    ) : (
                                      (review.userName && review.userName.charAt(0)) || "U"
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-[#10213B]">{review.userName || "Anonymous"}</p>
                                    <p className="text-xs text-[#65748A]">{formatDate(review.date)}</p>
                                  </div>
                                  <div className="ml-auto flex items-center gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <span key={i} className={i < (review.rating || 0) ? "text-[#FFAB00]" : "text-[#D8E1E7]"}>
                                        ★
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm text-[#405066] leading-relaxed">{review.text || ""}</p>
                                
                                {review.photos && review.photos.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-[#D8E1E7]">
                                    <div className="flex gap-2 flex-wrap">
                                      {review.photos.slice(0, 6).map((photo, idx) => (
                                        <div
                                          key={photo.publicId || idx}
                                          className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#CDF5E5] border border-[#D8E1E7] cursor-pointer hover:scale-105 transition-transform"
                                          onClick={() => window.open(photo.url, "_blank")}
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
                                            <div className="flex items-center justify-center h-full text-[#006C56]/30 text-lg">
                                              📷
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {review.photos.length > 6 && (
                                        <div className="w-16 h-16 rounded-lg bg-[#F1F6F4] border border-[#D8E1E7] flex items-center justify-center text-[#65748A] text-xs font-medium">
                                          +{review.photos.length - 6}
                                        </div>
                                      )}
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