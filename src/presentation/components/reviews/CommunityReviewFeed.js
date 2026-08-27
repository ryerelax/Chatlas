"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReviewCard from "./ReviewCard";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const COMMUNITY_PAGE_SIZE = 5;

const INITIAL_PAGINATION = {
  page: 1,
  limit: COMMUNITY_PAGE_SIZE,
  totalReviews: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

export default function CommunityReviewFeed() {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);
  const isBackgroundOrderRefreshRef = useRef(false);

  const sortOptions = [
    { value: "newest", label: t("reviewSortNewest") },
    { value: "most-liked", label: t("reviewSortMostLiked") },
    { value: "highest-rating", label: t("reviewSortHighestRating") },
  ];
  const filterOptions = [
    { value: "all", label: t("communityFilterAll") },
    { value: "with-photos", label: t("communityFilterWithPhotos") },
    { value: "rating-4-plus", label: t("communityFilterHighlyRated") },
  ];

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
          filter,
        });

        if (search) {
          searchParams.set("search", search);
        }

        const response = await fetch(`/api/reviews/feed?${searchParams}`, {
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || t("errorGeneric"));
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
          setError(loadError.message || t("errorGeneric"));
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
  }, [filter, page, requestVersion, search, sort, t]);

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

  function handleFilterChange(event) {
    setFilter(event.target.value);
    setPage(1);
  }

  const paginationItems = createPaginationItems(
    pagination.page,
    pagination.totalPages
  );

  return (
    <section aria-labelledby="community-feed-heading">
      <div className="rounded-[18px] border border-attraction-border bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={handleSearchSubmit} role="search">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="community-review-search"
                className="mb-1.5 block text-sm font-semibold text-attraction-ink"
              >
                {t("search")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="community-review-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  maxLength={80}
                  placeholder={t("communitySearchPlaceholder")}
                  className="min-h-[46px] min-w-0 flex-1 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm text-attraction-ink placeholder:text-attraction-muted focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-[#FFB000] px-5 text-sm font-semibold text-[#10213B] transition-colors duration-200 hover:bg-[#F3A600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                >
                  {t("search")}
                </button>
                {search && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                  >
                    {t("communityClearSearch")}
                  </button>
                )}
              </div>
            </div>

            <div className="w-full lg:w-auto">
              <label
                htmlFor="community-review-sort"
                className="mb-1.5 block text-sm font-semibold text-attraction-ink"
              >
                {t("sortBy")}
              </label>
              <select
                id="community-review-sort"
                value={sort}
                onChange={handleSortChange}
                className="min-h-[46px] w-full rounded-[10px] border border-attraction-border-strong bg-white px-3 text-sm font-medium text-attraction-body focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30 lg:min-w-52"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-semibold text-attraction-ink">
              {t("communityFilterLabel")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <label
                  key={option.value}
                  className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors duration-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-attraction-primary ${
                    filter === option.value
                      ? "border-attraction-primary bg-attraction-primary-soft-strong text-attraction-primary-dark"
                      : "border-attraction-border-strong bg-white text-attraction-body hover:bg-attraction-surface-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="community-review-filter"
                    value={option.value}
                    checked={filter === option.value}
                    onChange={handleFilterChange}
                    className="sr-only"
                  />
                  {filter === option.value && (
                    <span className="mr-1.5" aria-hidden="true">
                      ✓
                    </span>
                  )}
                  <span>{option.label}</span>
                  {filter === option.value && (
                    <span className="sr-only"> {t("selected")}</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        </form>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <CommunityFeedSkeleton t={t} />
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
              {t("communityRetry")}
            </button>
          </div>
        ) : reviews.length === 0 ? (
          <CommunityEmptyState
            search={search}
            filter={filter}
            onClearSearch={handleClearSearch}
            t={t}
          />
        ) : (
          <>
            <p
              className="mb-4 text-sm text-attraction-muted"
              aria-live="polite"
            >
              {pagination.totalReviews} {t("reviews")}
              {search ? ` — “${search}”` : ""}
            </p>

            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={review}
                  enableComments
                  showAttractionCta
                  attractionCtaLabel={t("communityViewAttraction")}
                  onLikeUpdated={
                    sort === "most-liked" ? handleLikeUpdated : undefined
                  }
                />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <nav
                className="mt-6 flex flex-wrap items-center justify-center gap-2"
                aria-label={t("communityPaginationLabel")}
              >
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  disabled={!pagination.hasPreviousPage}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("previous")}
                </button>

                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="inline-flex h-11 min-w-8 items-center justify-center text-attraction-muted"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      aria-label={t("communityGoToPage", { page: item })}
                      aria-current={
                        item === pagination.page ? "page" : undefined
                      }
                      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-[10px] border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary ${
                        item === pagination.page
                          ? "border-attraction-primary bg-attraction-primary text-white shadow-sm"
                          : "border-attraction-border-strong bg-white text-attraction-body hover:bg-attraction-surface-soft"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("next")}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CommunityEmptyState({ search, filter, onClearSearch, t }) {
  let message = t("communityEmpty");

  if (search) {
    message = t("communitySearchEmpty", { query: search });
  } else if (filter === "with-photos") {
    message = t("communityPhotosEmpty");
  } else if (filter === "rating-4-plus") {
    message = t("communityHighlyRatedEmpty");
  }

  return (
    <div className="rounded-[18px] bg-attraction-surface-soft px-6 py-11 text-center text-attraction-body">
      <h2 className="text-base font-semibold text-attraction-ink">{message}</h2>
      {search && (
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
        >
          {t("communityClearSearch")}
        </button>
      )}
    </div>
  );
}

function createPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, totalPages]);

  if (currentPage <= 4) {
    [2, 3, 4, 5].forEach((page) => visiblePages.add(page));
  } else if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach(
      (page) => visiblePages.add(page)
    );
  } else {
    [currentPage - 1, currentPage, currentPage + 1].forEach((page) =>
      visiblePages.add(page)
    );
  }

  const sortedPages = [...visiblePages].sort((first, second) => first - second);
  const items = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function CommunityFeedSkeleton({ t }) {
  return (
    <div className="space-y-4" role="status" aria-label={t("loading")}>
      {[1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-[18px] border border-attraction-border bg-white p-[18px] shadow-sm sm:p-6"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[#E7ECEF] sm:h-14 sm:w-14" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-[#E7ECEF]" />
              <div className="mt-2.5 h-3 w-28 rounded bg-[#F4F6F7]" />
            </div>
          </div>
          <div className="mt-5 h-4 rounded bg-[#E7ECEF] sm:ml-[72px]" />
          <div className="mt-2.5 h-4 w-3/4 rounded bg-[#F4F6F7] sm:ml-[72px]" />
        </div>
      ))}
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
