"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  BackArrowIcon,
  SearchIcon,
} from "@/presentation/components/AttractionIcons";
import { ATTRACTION_CATEGORIES } from "@/business/services/attractionCategories";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 6;
const MAX_DESCRIPTION_LENGTH = 2000;

export default function AddAttractionPage() {
  const { data: session, status } = useSession();
  const { t, translateCategory } = useLanguage();

  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [category, setCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [description, setDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  const [photoItems, setPhotoItems] = useState([]);
  const [photoError, setPhotoError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submittedAttraction, setSubmittedAttraction] = useState(null);

  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  const isResultsOpen =
    !selectedPlace &&
    query.trim().length >= MIN_QUERY_LENGTH &&
    results !== null;

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
          throw new Error(result.message || t("errorGeneric"));
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
  }, [query, sessionToken, selectedPlace, t]);

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

  function handlePhotoChange(event) {
    const newFiles = Array.from(event.target.files || []);
    event.target.value = "";
    setPhotoError("");

    if (newFiles.length === 0) {
      return;
    }

    setPhotoItems((current) => {
      const accepted = [];
      let rejectionReason = "";

      for (const file of newFiles) {
        if (current.length + accepted.length >= MAX_PHOTOS) {
          rejectionReason = t("uploadHint");
          break;
        }
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
          rejectionReason = t("unsupportedFormat");
          continue;
        }
        if (file.size > MAX_PHOTO_SIZE_BYTES) {
          rejectionReason = t("fileTooLarge");
          continue;
        }
        accepted.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (rejectionReason) {
        setPhotoError(rejectionReason);
      }

      return [...current, ...accepted];
    });
  }

  function handleRemovePhoto(id) {
    setPhotoItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    setPhotoError("");
  }

  function clearAllPhotos() {
    setPhotoItems((current) => {
      for (const item of current) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setCategoryError("");
    setDescriptionError("");
    setSubmitError("");

    if (!selectedPlace) {
      setSubmitError("searchPlaceholder");
      return;
    }

    if (!category) {
      setCategoryError(t("attractionCategory"));
      return;
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setDescriptionError(t("errorGeneric"));
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("googlePlaceId", selectedPlace.placeId);
      formData.set("category", category);
      formData.set("description", description);
      formData.set("sessionToken", sessionToken);
      for (const item of photoItems) {
        formData.append("photos", item.file);
      }

      const response = await fetch("/api/attractions/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || t("submitFailed"));
      }

      setSubmittedAttraction(result.data);
      setSelectedPlace(null);
      setQuery("");
      setCategory("");
      setDescription("");
      setSessionToken(crypto.randomUUID());
      clearAllPhotos();
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
        <p className="text-center text-attraction-muted">{t("loading")}</p>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-attraction-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-attraction-ink">
            {t("unauthorized")}
          </h1>
          <p className="mt-3 text-attraction-body">
            {t("signInToAddAttraction")}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
          >
            {t("signIn")}
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
          {t("back")}
        </Link>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-attraction-ink md:text-3xl">
          {t("addAttractionTitle")}
        </h1>
        <p className="mb-7 text-attraction-body">{t("searchPlaceholder")}</p>

        {submittedAttraction ? (
          <div className="rounded-[18px] border border-attraction-border bg-white p-6 text-center shadow-sm">
            <p className="mb-1 text-lg font-bold text-attraction-ink">
              &ldquo;{submittedAttraction.name}&rdquo; — {t("submitSuccess")}
            </p>
            <p className="mb-6 text-attraction-body">{t("submitSuccess")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/attractions/${submittedAttraction._id}`}
                className="rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
              >
                {t("view")}
              </Link>
              <button
                type="button"
                onClick={handleAddAnother}
                className="rounded-[10px] border border-attraction-border-strong bg-white px-5 py-3 font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
              >
                {t("addAttractionTitle")}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm"
          >
            <label
              htmlFor="place-search"
              className="mb-2 block font-semibold text-attraction-ink"
            >
              {t("search")}
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
                  placeholder={t("searchPlaceholder")}
                  autoComplete="off"
                  className="w-full text-attraction-ink outline-none placeholder:text-attraction-muted"
                />
                {isSearching && (
                  <span className="text-xs font-semibold text-attraction-muted">
                    {t("loading")}
                  </span>
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

              {isResultsOpen &&
                !isSearching &&
                results.length === 0 &&
                !searchError && (
                  <div className="absolute z-10 mt-2 w-full rounded-lg border border-attraction-border bg-white px-4 py-3 text-sm text-attraction-muted shadow-lg">
                    {t("noAttractionsFound")}
                  </div>
                )}
            </div>

            {searchError && (
              <p className="mt-2 text-sm text-attraction-error">{searchError}</p>
            )}

            {selectedPlace && (
              <p className="mt-2 text-sm font-semibold text-attraction-primary">
                {selectedPlace.text}
              </p>
            )}

            <div className="mt-5">
              <label
                htmlFor="category"
                className="mb-2 block font-semibold text-attraction-ink"
              >
                {t("attractionCategory")}
              </label>
              <select
                id="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-lg border border-attraction-border px-4 py-3 text-attraction-ink outline-none focus:border-attraction-primary"
              >
                <option value="">{t("selectCategory")}</option>
                {ATTRACTION_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {translateCategory ? translateCategory(item) : item}
                  </option>
                ))}
              </select>
              {categoryError && (
                <p className="mt-2 text-sm text-attraction-error">
                  {categoryError}
                </p>
              )}
            </div>

            <div className="mt-5">
              <label
                htmlFor="description"
                className="mb-2 block font-semibold text-attraction-ink"
              >
                {t("attractionDescriptionOptional")}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder={t("attractionDescriptionPlaceholder")}
                className="w-full rounded-lg border border-attraction-border px-4 py-3 text-attraction-ink outline-none focus:border-attraction-primary"
              />
              <p className="mt-1 text-right text-xs text-attraction-muted">
                {description.length} / {MAX_DESCRIPTION_LENGTH}
              </p>
              {descriptionError && (
                <p className="mt-2 text-sm text-attraction-error">
                  {descriptionError}
                </p>
              )}
            </div>

            <div className="mt-5">
              <label className="mb-2 block font-semibold text-attraction-ink">
                {t("photos")}{" "}
                <span className="font-normal text-attraction-muted">
                  ({t("photosOptional")})
                </span>
              </label>

              {photoItems.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-3">
                  {photoItems.map((item) => (
                    <div key={item.id} className="relative">
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        aria-label={t("remove")}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-attraction-border-strong bg-white text-xs font-bold text-attraction-error shadow-sm transition hover:bg-red-50"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photoItems.length < MAX_PHOTOS && (
                <>
                  <input
                    ref={fileInputRef}
                    id="photos"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="sr-only"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-attraction-border bg-attraction-primary-soft px-4 py-2 text-sm font-semibold text-attraction-primary transition hover:bg-[#CDF5E5]"
                    >
                      {t("choosePhoto")}
                    </button>
                    <span className="text-sm text-attraction-muted">
                      {photoItems.length === 0
                        ? t("noFileChosen")
                        : t("photosSelected", { count: photoItems.length })}
                    </span>
                  </div>
                </>
              )}

              <p className="mt-2 text-xs text-attraction-muted">
                {t("uploadHint")} (max {MAX_PHOTOS})
              </p>

              {photoError && (
                <p className="mt-2 text-sm text-attraction-error">{photoError}</p>
              )}
            </div>

            {submitError && (
              <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-attraction-error">
                {t(submitError)}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t("saving") : t("submitAttraction")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}