"use client";

import { useEffect, useState } from "react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import ReviewCard from "./ReviewCard";

export default function ReviewList({ attractionId, refreshVersion = 0 }) {
  const { refreshAttractionReviews } = useReviews();
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [localRefreshVersion, setLocalRefreshVersion] = useState(refreshVersion);

  // Listen for reviewAdded flag to auto-refresh
  useEffect(() => {
    const handleReviewAdded = () => {
      if (localStorage.getItem('reviewAdded') === 'true') {
        localStorage.removeItem('reviewAdded');
        console.log("ReviewList: Auto-refreshing after review added");
        // Increment refresh version to trigger reload
        setLocalRefreshVersion(prev => prev + 1);
        // Also refresh context
        refreshAttractionReviews(attractionId);
      }
    };

    // Check immediately on mount
    handleReviewAdded();

    // Listen for focus and visibility changes
    const refreshIfNeeded = () => {
      if (localStorage.getItem('reviewAdded') === 'true') {
        localStorage.removeItem('reviewAdded');
        console.log("ReviewList: Auto-refreshing after focus/visibility");
        setLocalRefreshVersion(prev => prev + 1);
        refreshAttractionReviews(attractionId);
      }
    };

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshIfNeeded();
      }
    });

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener('visibilitychange', refreshIfNeeded);
    };
  }, [attractionId, refreshAttractionReviews]);

  // Load reviews from API
  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(
          `/api/reviews?attractionId=${encodeURIComponent(attractionId)}`,
          { signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load reviews.");
        }

        setReviews(result.data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    if (attractionId) {
      loadReviews();
    }

    return () => controller.abort();
  }, [attractionId, localRefreshVersion]);

  if (isLoading) {
    return <ReviewListSkeleton />;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[10px] bg-[#FDECEC] px-4 py-3 text-sm text-attraction-error"
      >
        {error}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-[18px] bg-attraction-surface-soft px-6 py-11 text-center text-attraction-body">
        <svg
          className="mx-auto h-10 w-10 text-attraction-primary"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 8h24v18H18l-7 6v-6H8V8Z"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M14 15h12M14 20h8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <h3 className="mt-4 text-base font-semibold text-attraction-ink">
          No reviews yet
        </h3>
        <p className="mt-2 text-sm leading-relaxed">
          Reviews from travellers will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard key={review._id} review={review} />
      ))}
    </div>
  );
}

function ReviewListSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Loading reviews"
    >
      {[1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-[18px] border border-attraction-border bg-white p-[18px] shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[#E7ECEF] sm:h-14 sm:w-14" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="h-4 w-32 rounded bg-[#E7ECEF]" />
                  <div className="mt-2.5 h-3 w-28 rounded bg-[#F4F6F7]" />
                </div>
                <div className="h-3 w-20 rounded bg-[#F4F6F7]" />
              </div>
            </div>
          </div>
          <div className="mt-5 h-4 rounded bg-[#E7ECEF] sm:ml-[72px]" />
          <div className="mt-2.5 h-4 w-3/4 rounded bg-[#F4F6F7] sm:ml-[72px]" />
        </div>
      ))}
      <span className="sr-only">Loading reviews...</span>
    </div>
  );
}