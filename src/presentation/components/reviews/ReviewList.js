"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReviewCard from "./ReviewCard";

const REVIEW_PAGE_SIZE = 5;
const REVIEW_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest-rating", label: "Highest Rating" },
  { value: "lowest-rating", label: "Lowest Rating" },
  { value: "most-liked", label: "Most Liked" },
];

export default function ReviewList({ attractionId, refreshVersion = 0 }) {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [requestVersion, setRequestVersion] = useState(0);
  const [lastRefreshVersion, setLastRefreshVersion] = useState(refreshVersion);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: REVIEW_PAGE_SIZE,
    totalReviews: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const isBackgroundOrderRefreshRef = useRef(false);

  if (lastRefreshVersion !== refreshVersion) {
    setLastRefreshVersion(refreshVersion);
    setPage(1);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      try {
        if (!isBackgroundOrderRefreshRef.current) {
          setIsLoading(true);
        }
        setError("");

        const searchParams = new URLSearchParams({
          attractionId,
          page: String(page),
          limit: String(REVIEW_PAGE_SIZE),
          sort,
        });
        const response = await fetch(`/api/reviews?${searchParams}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load reviews.");
        }

        const nextPagination = result.pagination;
        const totalReviews = Number(nextPagination?.totalReviews);
        const totalPages = Number(nextPagination?.totalPages);

        if (
          Number.isInteger(totalReviews) &&
          totalReviews > 0 &&
          Number.isInteger(totalPages) &&
          totalPages > 0 &&
          page > totalPages
        ) {
          setPage(totalPages);
          return;
        }

        setReviews(Array.isArray(result.data) ? result.data : []);
        setPagination({
          page: Number(nextPagination?.page) || page,
          limit: Number(nextPagination?.limit) || REVIEW_PAGE_SIZE,
          totalReviews:
            Number.isInteger(totalReviews) && totalReviews >= 0
              ? totalReviews
              : 0,
          totalPages:
            Number.isInteger(totalPages) && totalPages >= 0 ? totalPages : 0,
          hasPreviousPage: Boolean(nextPagination?.hasPreviousPage),
          hasNextPage: Boolean(nextPagination?.hasNextPage),
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          isBackgroundOrderRefreshRef.current = false;
          setIsLoading(false);
        }
      }
    }

    if (attractionId) {
      loadReviews();
    }

    return () => controller.abort();
  }, [attractionId, page, refreshVersion, requestVersion, sort]);

  const handleLikeUpdated = useCallback(() => {
    isBackgroundOrderRefreshRef.current = true;
    setRequestVersion((version) => version + 1);
  }, []);

  function handleSortChange(event) {
    setSort(event.target.value);
    setPage(1);
  }

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
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-attraction-muted" aria-live="polite">
          {pagination.totalReviews}{" "}
          {pagination.totalReviews === 1 ? "review" : "reviews"}
        </p>

        <div className="w-full sm:w-auto">
          <label
            htmlFor="review-sort"
            className="mb-1.5 block text-sm font-semibold text-attraction-ink"
          >
            Sort reviews
          </label>
          <select
            id="review-sort"
            value={sort}
            onChange={handleSortChange}
            className="min-h-11 w-full rounded-[10px] border border-attraction-border-strong bg-white px-3 text-sm font-medium text-attraction-body transition-colors duration-200 focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30 sm:min-w-48"
          >
            {REVIEW_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard
            key={review._id}
            review={review}
            onLikeUpdated={sort === "most-liked" ? handleLikeUpdated : undefined}
          />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-between gap-3"
          aria-label="Review pages"
        >
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage - 1)}
            disabled={!pagination.hasPreviousPage || isLoading}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          <p
            className="text-center text-sm font-medium text-attraction-muted"
            aria-live="polite"
          >
            Page {pagination.page} of {pagination.totalPages}
          </p>

          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={!pagination.hasNextPage || isLoading}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
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
