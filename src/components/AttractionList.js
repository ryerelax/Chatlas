"use client";

import { useEffect, useState } from "react";
import AttractionCard from "@/components/AttractionCard";

export default function AttractionList() {
  const [attractions, setAttractions] = useState([]);

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [category, setCategory] = useState("All");
  const [appliedCategory, setAppliedCategory] = useState("All");

  const [minRating, setMinRating] = useState("0");
  const [appliedMinRating, setAppliedMinRating] = useState("0");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

        if (appliedMinRating !== "0") {
          query.set("minRating", appliedMinRating);
        }

        const url = query.toString()
          ? `/api/attractions?${query.toString()}`
          : "/api/attractions";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Unable to load attractions.");
        }

        const result = await response.json();
        setAttractions(result.data || []);
      } catch (error) {
        console.error("Failed to load attractions:", error);
        setError("Failed to load attractions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAttractions();
  }, [appliedSearch, appliedCategory, appliedMinRating]);

  function handleSearch(event) {
    event.preventDefault();

    setAppliedSearch(search.trim());
    setAppliedCategory(category);
    setAppliedMinRating(minRating);
  }

  function handleReset() {
    setSearch("");
    setAppliedSearch("");

    setCategory("All");
    setAppliedCategory("All");

    setMinRating("0");
    setAppliedMinRating("0");
  }

  function getResultMessage() {
    const criteria = [];

    if (appliedSearch) {
      criteria.push(`keyword "${appliedSearch}"`);
    }

    if (appliedCategory !== "All") {
      criteria.push(`category ${appliedCategory}`);
    }

    if (appliedMinRating !== "0") {
      criteria.push(`rating ${appliedMinRating} and above`);
    }

    if (criteria.length === 0) {
      return `${attractions.length} attraction(s) available`;
    }

    return `${attractions.length} result(s) found for ${criteria.join(", ")}`;
  }

  return (
    <section>
      {/* TODO: Refine the search and filter area based on the final Chatlas branding. */}
      <form
        onSubmit={handleSearch}
        className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <label
          htmlFor="attraction-search"
          className="mb-2 block font-semibold text-gray-900"
        >
          Search Attractions
        </label>

        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto_auto]">
          <input
            id="attraction-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, address, or category"
            className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
          />

          {/* TODO: Replace these fixed categories with categories loaded dynamically from the database. */}
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
          >
            <option value="All">All Categories</option>
            <option value="Museum">Museum</option>
            <option value="Religious">Religious</option>
            <option value="Tourist">Tourist</option>
            <option value="Historical">Historical</option>
            <option value="Nature">Nature</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Gallery">Gallery</option>
          </select>

          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
          >
            <option value="0">Any Rating</option>
            <option value="3">3.0 and above</option>
            <option value="3.5">3.5 and above</option>
            <option value="4">4.0 and above</option>
            <option value="4.5">4.5 and above</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700"
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
      </form>

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
            Try changing the keyword, category, rating, or clear all filters.
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
          {/* TODO: Add a location-area filter when location groups are finalized. */}
          {/* TODO: Refine the grid spacing and responsive layout based on the final Chatlas design. */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {attractions.map((attraction) => (
                <AttractionCard
                key={attraction._id}
                attraction={attraction}
                />
            ))}
          </div>
        </>
      )}
    </section>
  );
}