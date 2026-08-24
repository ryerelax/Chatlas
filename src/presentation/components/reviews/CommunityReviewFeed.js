"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReviewCard from "./ReviewCard";

const COMMUNITY_PAGE_SIZE = 5;
const COMMUNITY_SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "most-liked", label: "Most Liked" },
  { value: "highest-rating", label: "Highest Rating" },
];

const INITIAL_PAGINATION = {
  page: 1,
  limit: COMMUNITY_PAGE_SIZE,
  totalReviews: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

export default function CommunityReviewFeed() {
  const [reviews, setReviews] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const isBackgroundOrderRefreshRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCommunityReviews() {
      try {
        if (!isBackgroundOrderRefreshRef.current) {
          setIsLoading(true);
        }
        setError("");

        const searchParams = new URLSearchParams({
          page: String(page),
          sort,
        });

        if (search) {
          searchParams.set("search", search);
        }

        const response = await fetch(`/api/reviews/feed?${searchParams}`, {
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "Unable to load Community reviews.");
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
          limit: Number(nextPagination?.limit) || COMMUNITY_PAGE_SIZE,
          totalReviews:
            Number.isInteger(totalReviews) && totalReviews >= 0
              ? totalReviews
              : 0,
          totalPages:
            Number.isInteger(totalPages) && totalPages >= 0 ? totalPages : 0,
          hasPreviousPage: Boolean(nextPagination?.hasPreviousPage),
          hasNextPage: Boolean(nextPagination?.hasNextPage),
        });
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(
            loadError.message || "Unable to load Community reviews."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          isBackgroundOrderRefreshRef.current = false;
          setIsLoading(false);
        }
      }
    }

    loadCommunityReviews();

    return () => controller.abort();
  }, [page, requestVersion, search, sort]);

  const handleLikeUpdated = useCallback(() => {
    isBackgroundOrderRefreshRef.current = true;
    setRequestVersion((version) => version + 1);
  }, []);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleClearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  function handleSortChange(event) {
    setSort(event.target.value);
    setPage(1);
  }

  return (
    <section aria-labelledby="community-feed-heading">
      <div className="rounded-[18px] border border-attraction-border bg-white p-4 shadow-sm sm:p-6">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-4 lg:flex-row lg:items-end"
          role="search"
        >
          <div className="min-w-0 flex-1">
            <label
              htmlFor="community-review-search"
              className="mb-1.5 block text-sm font-semibold text-attraction-ink"
            >
              Search reviews
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="community-review-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={80}
                placeholder="Search review text or attraction"
                className="min-h-[46px] min-w-0 flex-1 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm text-attraction-ink placeholder:text-attraction-muted focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30"
              />
              <button
                type="submit"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-[#FFB000] px-5 text-sm font-semibold text-[#10213B] transition-colors duration-200 hover:bg-[#F3A600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
              >
                Search
              </button>
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="w-full lg:w-auto">
            <label
              htmlFor="community-review-sort"
              className="mb-1.5 block text-sm font-semibold text-attraction-ink"
            >
              Sort reviews
            </label>
            <select
              id="community-review-sort"
              value={sort}
              onChange={handleSortChange}
              className="min-h-[46px] w-full rounded-[10px] border border-attraction-border-strong bg-white px-3 text-sm font-medium text-attraction-body transition-colors duration-200 focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30 lg:min-w-52"
            >
              {COMMUNITY_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <CommunityFeedSkeleton />
        ) : error ? (
          <div
            role="alert"
            className="rounded-[10px] bg-[#FDECEC] px-4 py-4 text-sm text-attraction-error"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRequestVersion((version) => version + 1)}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-error px-4 font-semibold transition-colors duration-200 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
            >
              Try again
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <CommunityEmptyState hasSearch={Boolean(search)} />
        ) : (
          <>
            <p
              className="mb-4 text-sm text-attraction-muted"
              aria-live="polite"
            >
              {pagination.totalReviews}{" "}
              {pagination.totalReviews === 1 ? "review" : "reviews"}
              {search ? ` matching “${search}”` : " from the Community"}
            </p>

            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={review}
                  onLikeUpdated={
                    sort === "most-liked" ? handleLikeUpdated : undefined
                  }
                />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <nav
                className="mt-6 flex items-center justify-between gap-3"
                aria-label="Community review pages"
              >
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
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
                  disabled={!pagination.hasNextPage}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CommunityEmptyState({ hasSearch }) {
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
      <h2 className="mt-4 text-base font-semibold text-attraction-ink">
        {hasSearch ? "No matching reviews" : "No reviews yet"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        {hasSearch
          ? "Try another review or attraction keyword."
          : "Reviews from travellers will appear here."}
      </p>
    </div>
  );
}

function CommunityFeedSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading Community reviews">
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
      <span className="sr-only">Loading Community reviews...</span>
    </div>
  );
}
