"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import ReviewComments from "@/presentation/components/reviews/ReviewComments";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import { formatLocaleDate } from "@/presentation/lib/formatLocaleDate";

export default function ReviewCard({
  review = {},
  onLikeUpdated,
  showAttractionCta = false,
  attractionCtaLabel = "",
  enableComments = false,
}) {
  const { status: sessionStatus } = useSession();
  const { t, lang } = useLanguage();
  const userName =
    review.reviewer?.name || review.userName || "Chatlas traveller";
  const userAvatar = review.reviewer?.avatar || review.userAvatar || "";
  const reviewerProfileHref = createDocumentHref(
    "/profiles",
    review.reviewer?.id
  );
  const attractionHref = createDocumentHref(
    "/attractions",
    review.attraction?.id
  );
  const rating = Number(review.rating) || 0;
  const photos = getValidPhotos(review.photos);
  const reviewId = review._id?.toString() || "";
  const [likeCount, setLikeCount] = useState(() =>
    normalizeLikeCount(review.likeCount)
  );
  const [likedByCurrentUser, setLikedByCurrentUser] = useState(
    Boolean(review.likedByCurrentUser)
  );
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likeError, setLikeError] = useState("");
  const [commentCount, setCommentCount] = useState(() =>
    normalizeCommentCount(review.commentCount)
  );
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lightboxImageRef = useRef(null);
  const originatingTriggerRef = useRef(null);
  const counterId = useId();
  const commentsSectionId = useId();
  const isLightboxOpen = activePhotoIndex !== null;
  const activePhoto = isLightboxOpen ? photos[activePhotoIndex] : null;

  const closeLightbox = useCallback(() => {
    setActivePhotoIndex(null);
  }, []);

  useEffect(() => {
    if (!isLightboxOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      const triggerToRestore = originatingTriggerRef.current;

      requestAnimationFrame(() => {
        if (triggerToRestore?.isConnected) {
          triggerToRestore.focus();
        }
      });
    };
  }, [isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (photos.length > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        setActivePhotoIndex(
          (current) => (current - 1 + photos.length) % photos.length
        );
        return;
      }

      if (photos.length > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        setActivePhotoIndex((current) => (current + 1) % photos.length);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableControls = dialogRef.current?.querySelectorAll(
        'button:not([disabled])'
      );

      if (!focusableControls?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstControl = focusableControls[0];
      const lastControl = focusableControls[focusableControls.length - 1];

      if (event.shiftKey && document.activeElement === firstControl) {
        event.preventDefault();
        lastControl.focus();
      } else if (!event.shiftKey && document.activeElement === lastControl) {
        event.preventDefault();
        firstControl.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, isLightboxOpen, photos.length]);

  function openLightbox(index, trigger) {
    originatingTriggerRef.current = trigger;
    setActivePhotoIndex(index);
  }

  function showPreviousPhoto() {
    setActivePhotoIndex(
      (current) => (current - 1 + photos.length) % photos.length
    );
  }

  function showNextPhoto() {
    setActivePhotoIndex((current) => (current + 1) % photos.length);
  }

  function handleLightboxClick(event) {
    if (event.target.closest("button")) {
      return;
    }

    const image = lightboxImageRef.current;

    if (!image?.naturalWidth || !image?.naturalHeight) {
      closeLightbox();
      return;
    }

    const imageContainer = image.getBoundingClientRect();
    const imageScale = Math.min(
      imageContainer.width / image.naturalWidth,
      imageContainer.height / image.naturalHeight
    );
    const displayedWidth = image.naturalWidth * imageScale;
    const displayedHeight = image.naturalHeight * imageScale;
    const displayedLeft =
      imageContainer.left + (imageContainer.width - displayedWidth) / 2;
    const displayedTop =
      imageContainer.top + (imageContainer.height - displayedHeight) / 2;
    const clickedImage =
      event.clientX >= displayedLeft &&
      event.clientX <= displayedLeft + displayedWidth &&
      event.clientY >= displayedTop &&
      event.clientY <= displayedTop + displayedHeight;

    if (!clickedImage) {
      closeLightbox();
    }
  }

  async function handleLikeClick() {
    if (
      sessionStatus !== "authenticated" ||
      !reviewId ||
      isUpdatingLike
    ) {
      return;
    }

    try {
      setIsUpdatingLike(true);
      setLikeError("");

      const response = await fetch(`/api/reviews/${reviewId}/like`, {
        method: likedByCurrentUser ? "DELETE" : "PUT",
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Unable to update this Review's likes.");
      }

      setLikeCount(normalizeLikeCount(result.data?.likeCount));
      setLikedByCurrentUser(Boolean(result.data?.likedByCurrentUser));
      onLikeUpdated?.(result.data);
    } catch (error) {
      setLikeError(error.message || "Unable to update this Review's likes.");
    } finally {
      setIsUpdatingLike(false);
    }
  }

  const isGuest = sessionStatus === "unauthenticated";
  const isLikeDisabled =
    sessionStatus !== "authenticated" || !reviewId || isUpdatingLike;
  const likeButtonLabel = isGuest
  ? t("signInToLikeReview")
  : likedByCurrentUser
    ? t("unlikeReview")
    : t("likeReview");
  const reviewerAvatar = userAvatar ? (
    <img
      src={userAvatar}
      alt={`${userName}'s profile`}
      className="h-12 w-12 shrink-0 rounded-full object-cover sm:h-14 sm:w-14"
    />
  ) : (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-attraction-primary-soft-strong text-base font-semibold text-attraction-primary-dark sm:h-14 sm:w-14"
      aria-hidden="true"
    >
      {getInitials(userName)}
    </div>
  );

  return (
    <article className="rounded-[18px] border border-attraction-border bg-white p-[18px] shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        {reviewerProfileHref ? (
          <Link
            href={reviewerProfileHref}
            aria-label={`View ${userName}'s public profile`}
            className="shrink-0 rounded-full transition-opacity duration-200 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
          >
            {reviewerAvatar}
          </Link>
        ) : (
          reviewerAvatar
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-snug text-attraction-ink">
                {reviewerProfileHref ? (
                  <Link
                    href={reviewerProfileHref}
                    className="rounded-sm transition-colors duration-200 hover:text-attraction-primary-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                  >
                    {userName}
                  </Link>
                ) : (
                  userName
                )}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} width="17" height="17" viewBox="0 0 14 14">
                      <path
                        d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.43L7 8.77l-3.09 1.73.59-3.43L2 4.635l3.455-.505L7 1z"
                        fill={star <= rating ? "#FFAB00" : "#D8E1E7"}
                      />
                    </svg>
                  ))}
                </div>
                <span className="sr-only">{rating} out of 5 stars</span>
                <span
                  className="text-[13px] font-semibold text-attraction-body"
                  aria-hidden="true"
                >
                  {rating}/5
                </span>
              </div>
              {attractionHref && review.attraction?.name && (
                <p className="mt-2 text-sm text-attraction-muted">
                  {t("reviewed")}{" "}
                  <Link
                    href={attractionHref}
                    className="rounded-sm font-semibold text-attraction-primary-dark transition-colors duration-200 hover:text-attraction-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
                  >
                    {review.attraction.name}
                  </Link>
                </p>
              )}
            </div>

            <time
              dateTime={review.createdAt}
              className="shrink-0 pt-0.5 text-right text-[13px] font-medium text-attraction-muted"
>
              {formatLocaleDate(review.createdAt, lang, "short") || t("dateUnavailable")}
          </time>
          </div>
        </div>
      </div>

      <p className="mt-5 whitespace-pre-wrap break-words text-base leading-[1.65] text-attraction-body sm:ml-[72px]">
        {review.reviewText}
      </p>

      {photos.length > 0 && (
        <div
          className={`mt-4 grid grid-cols-1 gap-2 sm:ml-[72px] ${
            photos.length > 1 ? "sm:grid-cols-2" : ""
          }`}
        >
          {photos.map((photo, index) => (
            <button
              type="button"
              key={photo.publicId || photo.url}
              onClick={(event) => openLightbox(index, event.currentTarget)}
              aria-label={`Open review photo ${index + 1} of ${photos.length}`}
              className={`relative block w-full overflow-hidden rounded-[14px] bg-attraction-primary-soft-strong text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary ${
                photos.length === 1
                  ? "aspect-[16/9]"
                  : photos.length === 3 && index === 0
                    ? "aspect-[16/9] sm:col-span-2"
                  : "aspect-[4/3]"
              }`}
            >
              <Image
                src={photo.url}
                alt={`Review photo ${index + 1} shared by ${userName}`}
                fill
                sizes={
                  photos.length === 1 || (photos.length === 3 && index === 0)
                    ? "(max-width: 743px) 100vw, 680px"
                    : "(max-width: 743px) 100vw, 340px"
                }
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div
        className={`mt-5 sm:ml-[72px] ${
          showAttractionCta || enableComments
            ? "flex flex-wrap items-center gap-3"
            : ""
        }`}
      >
        <button
          type="button"
          onClick={handleLikeClick}
          disabled={isLikeDisabled}
          aria-pressed={likedByCurrentUser}
          aria-label={`${likeButtonLabel}. ${likeCount} ${
            likeCount === 1 ? t("likeSingular") : t("likePlural")
          }.`}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary disabled:cursor-not-allowed disabled:opacity-60 ${
            likedByCurrentUser
              ? "border-attraction-primary bg-attraction-primary-soft-strong text-attraction-primary-dark"
              : "border-attraction-border-strong bg-white text-attraction-body hover:bg-attraction-primary-soft"
          }`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={likedByCurrentUser ? "currentColor" : "none"}
            aria-hidden="true"
          >
            <path
              d="M7.5 10.5v9H4.75a1.75 1.75 0 0 1-1.75-1.75v-5.5a1.75 1.75 0 0 1 1.75-1.75H7.5Zm0 0 3.6-6.3a1.65 1.65 0 0 1 3.05 1.02V9h4.31a2.54 2.54 0 0 1 2.48 3.08l-1.23 5.75a2.75 2.75 0 0 1-2.69 2.17H7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {isUpdatingLike
              ? t("updating")
              : isGuest
                ? t("signInToLike")
                : likedByCurrentUser
                  ? t("liked")
                  : t("like")}
          </span>
          <span aria-live="polite">{likeCount}</span>
        </button>

        {enableComments && (
          <button
            type="button"
            onClick={() => setCommentsExpanded((expanded) => !expanded)}
            aria-expanded={commentsExpanded}
            aria-controls={commentsSectionId}
            aria-label={`${
              commentsExpanded
                ? t("reviewHideComments")
                : t("reviewViewComments")
            }. ${commentCount} ${
              commentCount === 1
                ? t("reviewComment")
                : t("reviewComments")
            }.`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-body transition-colors duration-200 hover:bg-attraction-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              {commentCount === 1
                ? t("reviewComment")
                : t("reviewComments")}
            </span>
            <span aria-live="polite">{commentCount}</span>
          </button>
        )}

        {showAttractionCta && attractionHref && attractionCtaLabel && (
          <Link
            href={attractionHref}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong bg-white px-4 text-sm font-semibold text-attraction-primary-dark transition-colors duration-200 hover:border-attraction-primary hover:bg-attraction-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary"
          >
            {attractionCtaLabel} <span aria-hidden="true">→</span>
          </Link>
        )}

        {likeError && (
          <p
            role="alert"
            className={`mt-2 text-sm text-attraction-error ${
              showAttractionCta || enableComments ? "basis-full" : ""
            }`}
          >
            {likeError}
          </p>
        )}
      </div>

      {enableComments && commentsExpanded && reviewId && (
        <ReviewComments
          reviewId={reviewId}
          sectionId={commentsSectionId}
          onCommentCountChange={setCommentCount}
        />
      )}

      {activePhoto && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Review photo viewer"
          aria-describedby={counterId}
          tabIndex={-1}
          onClick={handleLightboxClick}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6"
        >
          <div className="relative flex h-full max-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center sm:max-h-[calc(100vh-3rem)]">
            <div className="relative h-full w-full overflow-hidden rounded-[18px]">
              <Image
                ref={lightboxImageRef}
                src={activePhoto.url}
                alt={`Review photo ${activePhotoIndex + 1} shared by ${userName}`}
                fill
                priority
                sizes="100vw"
                className="object-contain"
              />
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              aria-label="Close photo viewer"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white text-attraction-ink shadow-lg transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary sm:right-4 sm:top-4"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPreviousPhoto}
                  aria-label="Show previous review photo"
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white text-attraction-ink shadow-lg transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary sm:left-4"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m15 18-6-6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={showNextPhoto}
                  aria-label="Show next review photo"
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white text-attraction-ink shadow-lg transition-colors duration-200 hover:bg-attraction-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-attraction-primary sm:right-4"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </>
            )}

            <p
              id={counterId}
              aria-live="polite"
              className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-[13px] font-semibold text-white sm:bottom-4"
            >
              {activePhotoIndex + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function getValidPhotos(photos) {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .filter(isValidReviewPhoto)
    .slice(0, 3);
}

function normalizeLikeCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function isValidReviewPhoto(photo) {
  if (
    !photo ||
    typeof photo.url !== "string" ||
    typeof photo.publicId !== "string" ||
    !photo.publicId.trim()
  ) {
    return false;
  }

  try {
    const photoUrl = new URL(photo.url);

    return (
      photoUrl.protocol === "https:" &&
      photoUrl.hostname === "res.cloudinary.com"
    );
  } catch {
    return false;
  }
}

function getInitials(userName) {
  return userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((namePart) => namePart[0])
    .join("")
    .toUpperCase();
}

function normalizeCommentCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

function createDocumentHref(basePath, documentId) {
  const normalizedId =
    typeof documentId === "string" ? documentId.trim() : "";

  return /^[a-f\d]{24}$/i.test(normalizedId)
    ? `${basePath}/${normalizedId}`
    : "";
}
