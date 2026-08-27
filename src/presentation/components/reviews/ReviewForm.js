"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_PHOTOS = 3;

export default function ReviewForm({ attractionId, onReviewSubmitted }) {
  const { addReview } = useReviews();
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [errors, setErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const selectedPhotosRef = useRef([]);
  const photoInputRef = useRef(null);
  const nextPhotoIdRef = useRef(0);

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      selectedPhotosRef.current.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
    };
  }, []);

  function handleRatingChange(value) {
    setRating(value);
    setStatusMessage("");
    setStatusType("");
    setErrors((current) => ({ ...current, rating: "" }));
  }

  function handleReviewTextChange(event) {
    setReviewText(event.target.value);
    setStatusMessage("");
    setStatusType("");
    setErrors((current) => ({ ...current, reviewText: "" }));
  }

  function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setStatusMessage("");
    setStatusType("");

    if (files.length === 0) {
      return;
    }

    if (selectedPhotos.length + files.length > MAX_REVIEW_PHOTOS) {
      setErrors((current) => ({
        ...current,
        photos: t("uploadHint"),
      }));
      return;
    }

    const invalidType = files.some(
      (file) => !ALLOWED_PHOTO_TYPES.includes(file.type)
    );

    if (invalidType) {
      setErrors((current) => ({
        ...current,
        photos: t("unsupportedFormat"),
      }));
      return;
    }

    const oversizedPhoto = files.some(
      (file) => file.size > MAX_PHOTO_SIZE_BYTES
    );

    if (oversizedPhoto) {
      setErrors((current) => ({
        ...current,
        photos: t("fileTooLarge"),
      }));
      return;
    }

    if (files.some((file) => file.size <= 0)) {
      setErrors((current) => ({
        ...current,
        photos: t("errorGeneric"),
      }));
      return;
    }

    const newPhotos = files.map((file) => ({
      id: `review-photo-${nextPhotoIdRef.current++}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedPhotos((current) => [...current, ...newPhotos]);
    setErrors((current) => ({ ...current, photos: "" }));
  }

  function handleRemovePhoto(photoId) {
    setSelectedPhotos((current) => {
      const photoToRemove = current.find((photo) => photo.id === photoId);

      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
      }

      return current.filter((photo) => photo.id !== photoId);
    });
    setStatusMessage("");
    setStatusType("");
    setErrors((current) => ({ ...current, photos: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (rating < 1 || rating > 5) {
      nextErrors.rating = t("yourRating");
    }

    if (!reviewText.trim()) {
      nextErrors.reviewText = t("reviewPlaceholder");
    } else if (reviewText.trim().length > 1000) {
      nextErrors.reviewText = t("errorGeneric");
    }

    if (selectedPhotos.length > MAX_REVIEW_PHOTOS) {
      nextErrors.photos = t("uploadHint");
    } else if (
      selectedPhotos.some(
        ({ file }) => !ALLOWED_PHOTO_TYPES.includes(file.type)
      )
    ) {
      nextErrors.photos = t("unsupportedFormat");
    } else if (
      selectedPhotos.some(({ file }) => file.size > MAX_PHOTO_SIZE_BYTES)
    ) {
      nextErrors.photos = t("fileTooLarge");
    } else if (selectedPhotos.some(({ file }) => file.size <= 0)) {
      nextErrors.photos = t("errorGeneric");
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatusMessage("");
      setStatusType("");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage("");
      setStatusType("");

      let response;

      if (selectedPhotos.length > 0) {
        const formData = new FormData();
        formData.set("attractionId", attractionId);
        formData.set("rating", String(rating));
        formData.set("reviewText", reviewText.trim());
        selectedPhotos.forEach(({ file }) => formData.append("photos", file));

        response = await fetch("/api/reviews", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attractionId,
            rating,
            reviewText: reviewText.trim(),
          }),
        });
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || t("errorGeneric"));
      }

      setRating(0);
      setReviewText("");
      setErrors({});
      selectedPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
      setSelectedPhotos([]);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setStatusType("success");
      setStatusMessage(t("profileUpdated"));
      addReview(result.data);
      onReviewSubmitted?.(result.data);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error.message || t("errorGeneric"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="mb-8 rounded-[18px] border border-attraction-border bg-white p-[18px] md:p-6"
    >
      <div>
        <fieldset
          aria-describedby={errors.rating ? "rating-error" : undefined}
        >
          <legend className="text-base font-semibold text-attraction-ink">
            {t("yourRating")} <span aria-hidden="true">*</span>
          </legend>

          <div className="mt-3 flex flex-wrap gap-2">
            {STAR_OPTIONS.map((value) => {
              const isSelected = rating === value;
              const isFilled = value <= rating;

              return (
                <label
                  key={value}
                  className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] border transition-colors duration-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-attraction-primary ${
                    isSelected
                      ? "border-attraction-primary bg-attraction-primary-soft ring-1 ring-attraction-primary"
                      : "border-attraction-border-strong bg-white hover:border-attraction-primary hover:bg-attraction-surface-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="review-rating"
                    value={value}
                    checked={isSelected}
                    onChange={() => handleRatingChange(value)}
                    className="sr-only"
                    aria-label={`${value} ${t("stars")}`}
                    required
                  />
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="m12 2.5 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5Z"
                      fill={isFilled ? "#FFAB00" : "#FFFFFF"}
                      stroke={isFilled ? "#B7791F" : "#65748A"}
                      strokeWidth="1.5"
                    />
                  </svg>
                </label>
              );
            })}
          </div>

          <p
            className="mt-2 text-[13px] font-medium text-attraction-body"
            aria-live="polite"
          >
            {rating
              ? `${rating} / 5 ${t("stars")}`
              : t("yourRating")}
          </p>

          {errors.rating && (
            <p
              id="rating-error"
              role="alert"
              className="mt-2 text-sm text-attraction-error"
            >
              {errors.rating}
            </p>
          )}
        </fieldset>
      </div>

      <div className="mt-6">
        <label
          htmlFor="review-text"
          className="text-base font-semibold text-attraction-ink"
        >
          {t("myReviews")} <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="review-text"
          value={reviewText}
          onChange={handleReviewTextChange}
          rows={5}
          maxLength={1000}
          required
          aria-invalid={Boolean(errors.reviewText)}
          aria-describedby={
            errors.reviewText
              ? "review-text-help review-text-count review-text-error"
              : "review-text-help review-text-count"
          }
          placeholder={t("reviewPlaceholder")}
          className="mt-3 min-h-[120px] w-full resize-y rounded-[10px] border border-attraction-border-strong bg-white p-3.5 text-base leading-relaxed text-attraction-ink outline-none transition-colors duration-200 placeholder:text-attraction-muted focus:border-attraction-primary focus:ring-2 focus:ring-attraction-primary"
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-[13px] font-medium text-attraction-muted">
          <p id="review-text-help">{t("reviewPlaceholder")}</p>
          <p id="review-text-count" aria-live="polite" className="shrink-0">
            {reviewText.length} / 1000
          </p>
        </div>
        {errors.reviewText && (
          <p
            id="review-text-error"
            role="alert"
            className="mt-2 text-sm text-attraction-error"
          >
            {errors.reviewText}
          </p>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-attraction-ink">
            {t("photos")}{" "}
            <span className="font-normal text-attraction-muted">
              ({t("attractionDescriptionOptional")})
            </span>
          </p>
          <span className="text-[13px] font-medium text-attraction-muted">
            {selectedPhotos.length} / {MAX_REVIEW_PHOTOS}
          </span>
        </div>

        <div className="mt-3 rounded-[14px] border border-dashed border-attraction-border-strong bg-attraction-surface-soft p-4 sm:p-6">
          {selectedPhotos.length > 0 && (
            <ul
              className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
              aria-label={t("photos")}
            >
              {selectedPhotos.map((photo, index) => (
                <li key={photo.id} className="min-w-0">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] bg-attraction-primary-soft-strong">
                    <Image
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      fill
                      unoptimized
                      sizes="(max-width: 743px) 100vw, 180px"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      disabled={isSubmitting}
                      aria-label={t("remove")}
                      className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-attraction-border bg-white/95 text-xl font-semibold leading-none text-attraction-error shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </div>
                  <p className="mt-2 truncate text-[13px] font-medium text-attraction-body">
                    {photo.file.name}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={photoInputRef}
            id="review-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handlePhotoSelection}
            disabled={
              isSubmitting || selectedPhotos.length >= MAX_REVIEW_PHOTOS
            }
            aria-label={t("photos")}
            aria-invalid={Boolean(errors.photos)}
            aria-describedby={
              errors.photos
                ? "review-photos-help review-photos-error"
                : "review-photos-help"
            }
            className="hidden"
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={
              isSubmitting || selectedPhotos.length >= MAX_REVIEW_PHOTOS
            }
            aria-describedby="review-photos-help"
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-5 text-[15px] font-semibold text-attraction-primary-dark transition-colors duration-200 hover:bg-attraction-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {selectedPhotos.length > 0 ? t("uploadPhoto") : t("uploadPhoto")}
          </button>
          <p
            id="review-photos-help"
            className="mt-3 text-[13px] font-medium leading-relaxed text-attraction-muted"
          >
            {t("uploadHint")} (max {MAX_REVIEW_PHOTOS})
          </p>
          {errors.photos && (
            <p
              id="review-photos-error"
              role="alert"
              className="mt-2 text-sm text-attraction-error"
            >
              {errors.photos}
            </p>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          role={statusType === "error" ? "alert" : "status"}
          className={`mt-6 rounded-[10px] px-4 py-3 text-sm leading-relaxed ${
            statusType === "error"
              ? "bg-[#FDECEC] text-attraction-error"
              : "bg-[#E8F7EF] text-attraction-body"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-attraction-primary px-5 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting ? t("saving") : t("submit")}
      </button>
    </form>
  );
}