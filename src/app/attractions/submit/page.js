"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { BackArrowIcon, SearchIcon } from "@/presentation/components/AttractionIcons";
import { ATTRACTION_CATEGORIES } from "@/business/services/attractionCategories";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

export default function AddAttractionPage() {
  const { data: session, status } = useSession();

  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  // null = no completed search to show yet (too-short query, or just cleared).
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [category, setCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedAttraction, setSubmittedAttraction] = useState(null);

  const abortControllerRef = useRef(null);

  const isResultsOpen = !selectedPlace && query.trim().length >= MIN_QUERY_LENGTH && results !== null;

  useEffect(() => {
    if (selectedPlace || query.trim().length < MIN_QUERY_LENGTH) {
      return;
    }

    const timer = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSearching(true);
      setSearchError("");

      try {
        const response = await fetch(
          `/api/attractions/search?q=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to search places.");
        }

        setResults(result.data);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Place search failed:", error);
          setSearchError(error.message);
          setResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, sessionToken, selectedPlace]);

  function handleSelectPlace(place) {
    setSelectedPlace(place);
    setQuery(place.text);
    setResults(null);
  }

  function handleChangeSearch(value) {
    setQuery(value);
    setSelectedPlace(null);
    setSubmittedAttraction(null);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults(null);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setCategoryError("");
    setSubmitError("");

    if (!selectedPlace) {
      setSubmitError("Please search for and select a place first.");
      return;
    }

    if (!category) {
      setCategoryError("Please choose a category.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/attractions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: selectedPlace.placeId,
          category,
          sessionToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to submit this attraction.");
      }

      setSubmittedAttraction(result.data);
      setSelectedPlace(null);
      setQuery("");
      setCategory("");
      setSessionToken(crypto.randomUUID());
    } catch (error) {
      console.error("Failed to submit attraction:", error);
      setSubmitError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddAnother() {
    setSubmittedAttraction(null);
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <p className="text-center text-attraction-muted">Loading...</p>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-attraction-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-attraction-ink">Sign in required</h1>
          <p className="mt-3 text-attraction-body">
            You need to be signed in to add a new attraction.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <div className="mx-auto max-w-[720px] px-4 py-8 pb-16 md:px-6">
        <Link
          href="/"
          className="mb-7 inline-flex h-10 items-center gap-2 rounded-full border border-attraction-border bg-white py-0 pl-3 pr-4 text-sm font-semibold text-attraction-body transition hover:border-attraction-border-strong hover:bg-attraction-surface-soft"
        >
          <BackArrowIcon />
          Back to attractions
        </Link>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-attraction-ink md:text-3xl">
          Add an attraction
        </h1>
        <p className="mb-7 text-attraction-body">
          Search for a real place on Google Places and add it to Chatlas. Submissions go live immediately.
        </p>

        {submittedAttraction ? (
          <div className="rounded-[18px] border border-attraction-border bg-white p-6 text-center shadow-sm">
            <p className="mb-1 text-lg font-bold text-attraction-ink">
              &ldquo;{submittedAttraction.name}&rdquo; has been added!
            </p>
            <p className="mb-6 text-attraction-body">
              It&apos;s live on Chatlas now — anyone can find it.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/attractions/${submittedAttraction._id}`}
                className="rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
              >
                View attraction
              </Link>
              <button
                type="button"
                onClick={handleAddAnother}
                className="rounded-[10px] border border-attraction-border-strong bg-white px-5 py-3 font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
              >
                Add another
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm"
          >
            <label htmlFor="place-search" className="mb-2 block font-semibold text-attraction-ink">
              Search for a place
            </label>

            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg border border-attraction-border px-4 py-3 focus-within:border-attraction-primary">
                <span className="text-attraction-muted">
                  <SearchIcon />
                </span>
                <input
                  id="place-search"
                  type="text"
                  value={query}
                  onChange={(event) => handleChangeSearch(event.target.value)}
                  placeholder="e.g. Jonker Street, Melaka"
                  autoComplete="off"
                  className="w-full text-attraction-ink outline-none placeholder:text-attraction-muted"
                />
                {isSearching && (
                  <span className="text-xs font-semibold text-attraction-muted">Searching…</span>
                )}
              </div>

              {isResultsOpen && results.length > 0 && (
                <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-attraction-border bg-white shadow-lg">
                  {results.map((place) => (
                    <li key={place.placeId}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlace(place)}
                        className="block w-full px-4 py-3 text-left text-sm text-attraction-body transition hover:bg-attraction-surface-soft"
                      >
                        {place.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {isResultsOpen && !isSearching && results.length === 0 && !searchError && (
                <div className="absolute z-10 mt-2 w-full rounded-lg border border-attraction-border bg-white px-4 py-3 text-sm text-attraction-muted shadow-lg">
                  No places found for &ldquo;{query}&rdquo;.
                </div>
              )}
            </div>

            {searchError && (
              <p className="mt-2 text-sm text-attraction-error">{searchError}</p>
            )}

            {selectedPlace && (
              <p className="mt-2 text-sm font-semibold text-attraction-primary">
                Selected: {selectedPlace.text}
              </p>
            )}

            <div className="mt-5">
              <label htmlFor="category" className="mb-2 block font-semibold text-attraction-ink">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-lg border border-attraction-border px-4 py-3 text-attraction-ink outline-none focus:border-attraction-primary"
              >
                <option value="">Select a category</option>
                {ATTRACTION_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {categoryError && (
                <p className="mt-2 text-sm text-attraction-error">{categoryError}</p>
              )}
            </div>

            {submitError && (
              <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-attraction-error">
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Adding attraction…" : "Add attraction"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
