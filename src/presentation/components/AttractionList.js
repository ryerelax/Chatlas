"use client";

import { useEffect, useState } from "react";
import AttractionCard from "@/presentation/components/AttractionCard";
import { LOCATION_AREAS } from "@/business/services/locationAreas";
import { ATTRACTION_CATEGORIES } from "@/business/services/attractionCategories";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const CATEGORIES = ["All", ...ATTRACTION_CATEGORIES];

const SORT_OPTIONS = [
  { value: "name", labelKey: "sortNameAsc" },
  { value: "rating", labelKey: "sortRating" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "mostReviewed", labelKey: "sortMostReviewed" },
];

export default function AttractionList() {
  const { t, translateCategory } = useLanguage();

  const [attractions, setAttractions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [category, setCategory] = useState("All");
  const [appliedCategory, setAppliedCategory] = useState("All");

  const [minRating, setMinRating] = useState("0");
  const [appliedMinRating, setAppliedMinRating] = useState("0");

  const [locationArea, setLocationArea] = useState("All");
  const [appliedLocationArea, setAppliedLocationArea] = useState("All");

  const [communitySubmitted, setCommunitySubmitted] = useState(false);
  const [appliedCommunitySubmitted, setAppliedCommunitySubmitted] =
    useState(false);

  const [sort, setSort] = useState("name");

  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    async function loadAttractions() {
      try {
        setIsLoading(true);
        setError("");

        const query = new URLSearchParams();

        if (appliedSearch) {
          query.set("search", appliedSearch);
        }

        if (appliedCategory !== "All") {
          query.set("category", appliedCategory);
        }

        if (appliedLocationArea !== "All") {
          query.set("locationArea", appliedLocationArea);
        }

        if (appliedMinRating !== "0") {
          query.set("minRating", appliedMinRating);
        }

        if (appliedCommunitySubmitted) {
          query.set("communitySubmitted", "true");
        }

        if (sort !== "name") {
          query.set("sort", sort);
        }

        query.set("page", String(page));

        const response = await fetch(`/api/attractions?${query.toString()}`);

        if (!response.ok) {
          throw new Error("Unable to load attractions.");
        }

        const result = await response.json();
        setAttractions(result.data || []);
        setTotalCount(result.count || 0);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (err) {
        console.error("Failed to load attractions:", err);
        setError("load_failed");
      } finally {
        setIsLoading(false);
      }
    }

    loadAttractions();
  }, [
    appliedSearch,
    appliedCategory,
    appliedLocationArea,
    appliedMinRating,
    appliedCommunitySubmitted,
    sort,
    page,
  ]);

  function handleSearch(event) {
    event.preventDefault();

    setAppliedSearch(search.trim());
    setAppliedCategory(category);
    setAppliedLocationArea(locationArea);
    setAppliedMinRating(minRating);
    setAppliedCommunitySubmitted(communitySubmitted);
    setPage(1);
  }

  function handleReset() {
    setSearch("");
    setAppliedSearch("");

    setCategory("All");
    setAppliedCategory("All");

    setLocationArea("All");
    setAppliedLocationArea("All");

    setMinRating("0");
    setAppliedMinRating("0");

    setCommunitySubmitted(false);
    setAppliedCommunitySubmitted(false);

    setSort("name");

    setPage(1);
    setShowMoreFilters(false);
  }

  function handleCategorySelect(item) {
    setCategory(item);
    setAppliedCategory(item);
    setPage(1);
  }

  function handleSortChange(event) {
    setSort(event.target.value);
    setPage(1);
  }

  function goToPreviousPage() {
    setPage((current) => Math.max(1, current - 1));
  }

  function goToNextPage() {
    setPage((current) => Math.min(totalPages, current + 1));
  }

  function getResultMessage() {
    const criteria = [];

    if (appliedSearch) {
      criteria.push(`${t("keyword")} "${appliedSearch}"`);
    }

    if (appliedCategory !== "All") {
      criteria.push(
        `${t("category")} ${translateCategory(appliedCategory)}`
      );
    }

    if (appliedLocationArea !== "All") {
      criteria.push(`${t("area")} ${appliedLocationArea}`);
    }

    if (appliedMinRating !== "0") {
      criteria.push(
        `${t("rating")} ${appliedMinRating} ${t("ratingAndAbove")}`
      );
    }

    if (appliedCommunitySubmitted) {
      criteria.push(t("communitySubmittedOnly"));
    }

    if (criteria.length === 0) {
      return t("attractionsAvailable", { count: totalCount });
    }

    return t("resultsFound", {
      count: totalCount,
      criteria: criteria.join(", "),
    });
  }

  return (
    <section>
      <form
        onSubmit={handleSearch}
        className="relative z-10 -mt-16 mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg"
      >
        <label
          htmlFor="attraction-search"
          className="mb-2 block font-semibold text-gray-900"
        >
          {t("searchAttractions")}
        </label>

        <div className="grid gap-3 lg:grid-cols-[2fr_auto_auto_auto]">
          <input
            id="attraction-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={() => setShowMoreFilters((current) => !current)}
            className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700"
          >
            {showMoreFilters ? t("hideFilters") : t("moreFilters")}
          </button>

          <button
            type="submit"
            className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-gray-900 transition hover:bg-amber-500"
          >
            {t("search")}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            {t("reset")}
          </button>
        </div>

        {showMoreFilters && (
          <div className="mt-5 grid gap-5 border-t border-gray-200 pt-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="minimum-rating"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                {t("minimumRating")}
              </label>

              <select
                id="minimum-rating"
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
              >
                <option value="0">{t("anyRating")}</option>
                <option value="3">3.0 {t("ratingAndAbove")}</option>
                <option value="3.5">3.5 {t("ratingAndAbove")}</option>
                <option value="4">4.0 {t("ratingAndAbove")}</option>
                <option value="4.5">4.5 {t("ratingAndAbove")}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="location-area"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                {t("locationArea")}
              </label>

              <select
                id="location-area"
                value={locationArea}
                onChange={(event) => setLocationArea(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
              >
                <option value="All">{t("allAreas")}</option>
                {LOCATION_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="community-submitted"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                {t("source")}
              </label>

              <select
                id="community-submitted"
                value={communitySubmitted ? "community" : "all"}
                onChange={(event) =>
                  setCommunitySubmitted(event.target.value === "community")
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
              >
                <option value="all">{t("allAttractions")}</option>
                <option value="community">{t("communitySubmittedOnly")}</option>
              </select>
            </div>
          </div>
        )}
      </form>

      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((item) => {
          const isSelected = appliedCategory === item;

          return (
            <button
              key={item}
              type="button"
              onClick={() => handleCategorySelect(item)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isSelected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-emerald-600 hover:text-emerald-700"
              }`}
            >
              {translateCategory(item)}
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{getResultMessage()}</p>

        <div className="flex items-center gap-2">
          <label htmlFor="attraction-sort" className="text-sm font-semibold text-gray-700">
            {t("sortBy")}
          </label>
          <select
            id="attraction-sort"
            value={sort}
            onChange={handleSortChange}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <p className="py-10 text-center text-gray-600">
          {t("loadingAttractions")}
        </p>
      )}

      {!isLoading && error && (
        <p className="py-10 text-center text-red-600">
          {t("failedLoadAttractions")}
        </p>
      )}

      {!isLoading && !error && attractions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-lg font-semibold text-gray-800">
            {t("noAttractionsFound")}
          </p>

          <p className="mt-2 text-gray-500">{t("tryChangingFilters")}</p>

          <button
            type="button"
            onClick={handleReset}
            className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
          >
            {t("clearSearchAndFilters")}
          </button>
        </div>
      )}

      {!isLoading && !error && attractions.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {attractions.map((attraction) => (
              <AttractionCard key={attraction._id} attraction={attraction} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Attraction results pages"
              className="mt-8 flex items-center justify-center gap-4"
            >
              <button
                type="button"
                onClick={goToPreviousPage}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("previous")}
              </button>

              <span className="text-sm font-semibold text-gray-700">
                {t("pageOf", { page, total: totalPages })}
              </span>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("next")}
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}