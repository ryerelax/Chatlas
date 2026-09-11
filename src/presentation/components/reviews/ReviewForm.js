"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import {
  CLIENT_IMAGE_TYPES,
  getImageUploadErrorKey,
} from "@/presentation/lib/imageUploadPresentation";

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const ALLOWED_PHOTO_TYPES = CLIENT_IMAGE_TYPES;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_PHOTOS = 3;

// Leave page longer than this → drop draft.
// Language remount cancels the timer → keep draft on same page.
const CLEAR_AFTER_UNMOUNT_MS = 800;

const reviewFormDraftByAttraction = new Map();
const clearTimersByAttraction = new Map();

function getDraft(attractionId) {
  return reviewFormDraftByAttraction.get(attractionId) || null;
}

function setDraft(attractionId, draft) {
  reviewFormDraftByAttraction.set(attractionId, { ...draft });
}

function clearDraft(attractionId) {
  reviewFormDraftByAttraction.delete(attractionId);
}

function clearAllDrafts() {
  reviewFormDraftByAttraction.clear();
}

function cancelScheduledClear(attractionId) {
  const timer = clearTimersByAttraction.get(attractionId);
  if (timer) {
    clearTimeout(timer);
    clearTimersByAttraction.delete(attractionId);
  }
}

function scheduleClear(attractionId) {
  cancelScheduledClear(attractionId);
  const timer = setTimeout(() => {
    clearDraft(attractionId);
    clearTimersByAttraction.delete(attractionId);
  }, CLEAR_AFTER_UNMOUNT_MS);
  clearTimersByAttraction.set(attractionId, timer);
}

function emptyState() {
  return {
    rating: 0,
    reviewText: "",
    errors: {},
    statusMessageKey: "",
    statusRawMessage: "",
    statusType: "",
    selectedPhotos: [],
    nextPhotoId: 0,
  };
}

function buildInitialState(attractionId) {
  const existing = getDraft(attractionId);
  if (!existing) {
    return emptyState();
  }

  // Same-page remount (language switch): restore everything including errors.
  return {
    rating: existing.rating ?? 0,
    reviewText: existing.reviewText ?? "",
    errors: existing.errors ?? {},
    statusMessageKey: existing.statusMessageKey ?? "",
    statusRawMessage: existing.statusRawMessage ?? "",
    statusType: existing.statusType ?? "",
    selectedPhotos: existing.selectedPhotos ?? [],
    nextPhotoId: existing.nextPhotoId ?? 0,
  };
}

export default function ReviewForm({ attractionId, onReviewSubmitted }) {
  const { addReview } = useReviews();
  const { t } = useLanguage();
  const { status: sessionStatus } = useSession();

  const initial = buildInitialState(attractionId);

  const [rating, setRating] = useState(initial.rating);
  const [reviewText, setReviewText] = useState(initial.reviewText);
  const [errors, setErrors] = useState(initial.errors);
  const [statusMessageKey, setStatusMessageKey] = useState(
    initial.statusMessageKey
  );
  const [statusRawMessage, setStatusRawMessage] = useState(
    initial.statusRawMessage
  );
  const [statusType, setStatusType] = useState(initial.statusType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(initial.selectedPhotos);
  const selectedPhotosRef = useRef(selectedPhotos);
  const photoInputRef = useRef(null);
  const nextPhotoIdRef = useRef(initial.nextPhotoId);
  const prevSessionStatusRef = useRef(sessionStatus);

  // Logout → clear drafts (privacy)
  useEffect(() => {
    const prev = prevSessionStatusRef.current;
    prevSessionStatusRef.current = sessionStatus;

    if (prev === "authenticated" && sessionStatus === "unauthenticated") {
      clearAllDrafts();
      cancelScheduledClear(attractionId);
      setRating(0);
      setReviewText("");
      setErrors({});
      setStatusMessageKey("");
      setStatusRawMessage("");
      setStatusType("");
      setSelectedPhotos([]);
      nextPhotoIdRef.current = 0;
    }
  }, [sessionStatus, attractionId]);

  // Cancel delayed clear on mount; schedule clear on unmount (leave page).
  useEffect(() => {
    cancelScheduledClear(attractionId);
    return () => {
      scheduleClear(attractionId);
    };
  }, [attractionId]);

  // Persist draft only while still on this page instance
  useEffect(() => {

    setDraft(attractionId, {
      rating,
      reviewText,
      errors,
      statusMessageKey,
      statusRawMessage,
      statusType,
      selectedPhotos,
      nextPhotoId: nextPhotoIdRef.current,
    });
  }, [
    attractionId,
    rating,
    reviewText,
    errors,
    statusMessageKey,
    statusRawMessage,
    statusType,
    selectedPhotos,
  ]);

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  function saveErrors(nextErrors) {
    setErrors(nextErrors);
  }

  function clearStatus() {
    setStatusMessageKey("");
    setStatusRawMessage("");
    setStatusType("");
  }

  function handleRatingChange(value) {
    setRating(value);
    clearStatus();
    const next = { ...errors };
    delete next.rating;
    saveErrors(next);
  }

  function handleReviewTextChange(event) {
    setReviewText(event.target.value);
    clearStatus();
    const next = { ...errors };
    delete next.reviewText;
    saveErrors(next);
  }

  function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    clearStatus();

    if (files.length === 0) {
      return;
    }

    if (selectedPhotos.length + files.length > MAX_REVIEW_PHOTOS) {
      saveErrors({ ...errors, photos: "uploadHint" });
      return;
    }

    const invalidType = files.some(
      (file) => !ALLOWED_PHOTO_TYPES.includes(file.type)
    );

    if (invalidType) {
      saveErrors({ ...errors, photos: "unsupportedFormat" });
      return;
    }

    const oversizedPhoto = files.some(
      (file) => file.size > MAX_PHOTO_SIZE_BYTES
    );

    if (oversizedPhoto) {
      saveErrors({ ...errors, photos: "fileTooLarge" });
      return;
    }

    if (files.some((file) => file.size <= 0)) {
      saveErrors({ ...errors, photos: "errorGeneric" });
      return;
    }

    const newPhotos = files.map((file) => ({
      id: `review-photo-${nextPhotoIdRef.current++}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedPhotos((current) => [...current, ...newPhotos]);
    const next = { ...errors };
    delete next.photos;
    saveErrors(next);
  }

  function handleRemovePhoto(photoId) {
    setSelectedPhotos((current) => {
      const photoToRemove = current.find((photo) => photo.id === photoId);

      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
      }

      return current.filter((photo) => photo.id !== photoId);
    });
    clearStatus();
    const next = { ...errors };
    delete next.photos;
    saveErrors(next);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (rating < 1 || rating > 5) {
      nextErrors.rating = "yourRating";
    }

    if (!reviewText.trim()) {
      nextErrors.reviewText = "reviewPlaceholder";
    } else if (reviewText.trim().length > 1000) {
      nextErrors.reviewText = "errorGeneric";
    }

    if (selectedPhotos.length > MAX_REVIEW_PHOTOS) {
      nextErrors.photos = "uploadHint";
    } else if (
      selectedPhotos.some(
        ({ file }) => !ALLOWED_PHOTO_TYPES.includes(file.type)
      )
    ) {
      nextErrors.photos = "unsupportedFormat";
    } else if (
      selectedPhotos.some(({ file }) => file.size > MAX_PHOTO_SIZE_BYTES)
    ) {
      nextErrors.photos = "fileTooLarge";
    } else if (selectedPhotos.some(({ file }) => file.size <= 0)) {
      nextErrors.photos = "errorGeneric";
    }

    saveErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      clearStatus();
      return;
    }

    try {
      setIsSubmitting(true);
      clearStatus();

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
        const apiMsg =
          typeof result?.message === "string" ? result.message : "";
        const isAuthError =
          response.status === 401 ||
          /sign in|signed in|log in|unauthorized/i.test(apiMsg);
        const imageErrorKey = getImageUploadErrorKey(result?.code);

        throw new Error(
          isAuthError
            ? "mustSignInToReview"
            : imageErrorKey || apiMsg || "errorGeneric"
        );
      }

      selectedPhotos.forEach((photo) => {
        URL.revokeObjectURL(photo.previewUrl);
      });
      setRating(0);
      setReviewText("");
      saveErrors({});
      setSelectedPhotos([]);
      nextPhotoIdRef.current = 0;
      clearDraft(attractionId);
      cancelScheduledClear(attractionId);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setStatusType("success");
      setStatusMessageKey("profileUpdated");
      setStatusRawMessage("");
      addReview(result.data);
      onReviewSubmitted?.(result.data);
    } catch (error) {
      const msg = error?.message || "errorGeneric";
      setStatusType("error");
      if (
        msg === "mustSignInToReview" ||
        msg === "errorGeneric" ||
        msg === "uploadHint" ||
        msg === "imageSafetyRejected" ||
        msg === "imageSafetyUnavailable" ||
        msg === "imageInvalid" ||
        msg === "imageTooLarge"
      ) {
        setStatusMessageKey(msg);
        setStatusRawMessage("");
      } else {
        setStatusMessageKey("errorGeneric");
        setStatusRawMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusText =
    statusRawMessage || (statusMessageKey ? t(statusMessageKey) : "");

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
            {rating ? `${rating} / 5 ${t("stars")}` : t("yourRating")}
          </p>

          {errors.rating && (
            <p
              id="rating-error"
              role="alert"
              className="mt-2 text-sm text-attraction-error"
            >
              {t(errors.rating)}
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
            {t(errors.reviewText)}
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
              {selectedPhotos.map((photo) => (
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
            accept="image/jpeg,image/png"
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
              {t(errors.photos)}
            </p>
          )}
        </div>
      </div>

      {statusText && (
        <div
          role={statusType === "error" ? "alert" : "status"}
          className={`mt-6 rounded-[10px] px-4 py-3 text-sm leading-relaxed ${
            statusType === "error"
              ? "bg-[#FDECEC] text-attraction-error"
              : "bg-[#E8F7EF] text-attraction-body"
          }`}
        >
          {statusText}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 flex h-[46px] w-full items-center justify-center rounded-[10px] bg-attraction-primary px-5 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-attraction-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isSubmitting && selectedPhotos.length > 0
          ? t("imageSafetyChecking")
          : isSubmitting
            ? t("saving")
            : t("submit")}
      </button>
    </form>
  );
}
