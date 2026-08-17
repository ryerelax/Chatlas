"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export default function ReviewCard({ review = {} }) {
  const userName = review.userName || "Chatlas traveller";
  const rating = Number(review.rating) || 0;
  const photos = getValidPhotos(review.photos);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lightboxImageRef = useRef(null);
  const originatingTriggerRef = useRef(null);
  const counterId = useId();
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

  return (
    <article className="rounded-[18px] border border-attraction-border bg-white p-[18px] shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        {review.userAvatar ? (
          <img
            src={review.userAvatar}
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
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-snug text-attraction-ink">
                {userName}
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
            </div>

            <time
              dateTime={review.createdAt}
              className="shrink-0 pt-0.5 text-right text-[13px] font-medium text-attraction-muted"
            >
              {formatReviewDate(review.createdAt)}
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

function formatReviewDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
