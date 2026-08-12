"use client";

import { useEffect, useState } from "react";
import AttractionCard from "@/components/AttractionCard";
import { LOCATION_AREAS } from "@/lib/locationAreas";

// TODO: Load category options dynamically when category management is finalized.
const CATEGORIES = [
  "All",
  "Museum",
  "Religious",
  "Tourist Attraction",
  "Historical",
  "Nature",
  "Entertainment",
  "Gallery",
];

export default function AttractionList() {
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

        query.set("page", String(page));

        const response = await fetch(`/api/attractions?${query.toString()}`);

        if (!response.ok) {
          throw new Error("Unable to load attractions.");
        }

        const result = await response.json();
        setAttractions(result.data || []);
        setTotalCount(result.count || 0);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (error) {
        console.error("Failed to load attractions:", error);
        setError("Failed to load attractions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAttractions();
  }, [appliedSearch, appliedCategory, appliedLocationArea, appliedMinRating, page]);

  function handleSearch(event) {
    event.preventDefault();

    setAppliedSearch(search.trim());
    setAppliedCategory(category);
    setAppliedLocationArea(locationArea);
    setAppliedMinRating(minRating);
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

    setPage(1);
    setShowMoreFilters(false);
  }

  function handleCategorySelect(item) {
    setCategory(item);
    setAppliedCategory(item);
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
      criteria.push(`keyword "${appliedSearch}"`);
    }

    if (appliedCategory !== "All") {
      criteria.push(`category ${appliedCategory}`);
    }

    if (appliedLocationArea !== "All") {
      criteria.push(`area ${appliedLocationArea}`);
    }

    if (appliedMinRating !== "0") {
      criteria.push(`rating ${appliedMinRating} and above`);
    }

    if (criteria.length === 0) {
      return `${totalCount} attraction(s) available`;
    }

    return `${totalCount} result(s) found for ${criteria.join(", ")}`;
  }

  return (
    <section>
      {/* Search and category filters follow the current Attraction Explorer Figma design. */}
      <form
        onSubmit={handleSearch}
        className="relative z-10 -mt-16 mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg"
      >
        <label
          htmlFor="attraction-search"
          className="mb-2 block font-semibold text-gray-900"
        >
          Search Attractions
        </label>

        <div className="grid gap-3 lg:grid-cols-[2fr_auto_auto_auto]">
          <input
            id="attraction-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search attractions in Melaka"
            className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
          />

          <button
            type="button"
            onClick={() => setShowMoreFilters((current) => !current)}
            className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700"
          >
            {showMoreFilters ? "Hide Filters" : "More Filters"}
          </button>

          <button
            type="submit"
            className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-gray-900 transition hover:bg-amber-500"
          >
            Search
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            Reset
          </button>
        </div>
        {showMoreFilters && (
          <div className="mt-5 grid gap-5 border-t border-gray-200 pt-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="minimum-rating"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Minimum Rating
              </label>

              <select
                id="minimum-rating"
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
              >
                <option value="0">Any Rating</option>
                <option value="3">3.0 and above</option>
                <option value="3.5">3.5 and above</option>
                <option value="4">4.0 and above</option>
                <option value="4.5">4.5 and above</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="location-area"
                className="mb-2 block text-sm font-semibold text-gray-800"
              >
                Location Area
              </label>

              {/* TODO: This zone list is a team draft, not yet confirmed (see src/lib/locationAreas.js). */}
              <select
                id="location-area"
                value={locationArea}
                onChange={(event) => setLocationArea(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
              >
                <option value="All">All Areas</option>
                {LOCATION_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
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
              {item === "All" ? "All Categories" : item}
            </button>
          );
        })}
      </div>

      <div className="mb-5">
        <p className="text-sm text-gray-600">
          {getResultMessage()}
        </p>
      </div>

      {isLoading && (
        <p className="py-10 text-center text-gray-600">
          Loading attractions...
        </p>
      )}

      {!isLoading && error && (
        <p className="py-10 text-center text-red-600">
          {error}
        </p>
      )}

      {!isLoading && !error && attractions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-lg font-semibold text-gray-800">
            No attractions found
          </p>

          <p className="mt-2 text-gray-500">
            Try changing the keyword, category, area, rating, or clear all filters.
          </p>

          <button
            type="button"
            onClick={handleReset}
            className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700"
          >
            Clear Search and Filters
          </button>
        </div>
      )}

      {!isLoading && !error && attractions.length > 0 && (
        <>
          {/* TODO: Refine the grid spacing and responsive layout based on the final Chatlas design. */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {attractions.map((attraction) => (
                <AttractionCard
                key={attraction._id}
                attraction={attraction}
                />
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
                Previous
              </button>

              <span className="text-sm font-semibold text-gray-700">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}