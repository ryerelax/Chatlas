"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function AttractionPhotoGallery({ attraction }) {
  const photos = attraction.photos || [];
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const isLightboxOpen = lightboxIndex !== null;

  useEffect(() => {
    if (!isLightboxOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setLightboxIndex(null);
      } else if (event.key === "ArrowRight") {
        setLightboxIndex((current) => (current + 1) % photos.length);
      } else if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => (current - 1 + photos.length) % photos.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, photos.length]);

  if (photos.length === 0) {
    return <NoPhotoPlaceholder />;
  }

  function showNext() {
    setLightboxIndex((current) => (current + 1) % photos.length);
  }

  function showPrevious() {
    setLightboxIndex((current) => (current - 1 + photos.length) % photos.length);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setLightboxIndex(0)}
        className="block w-full overflow-hidden rounded-[18px] border border-attraction-border"
      >
        <div className="relative h-64 w-full md:h-80">
          <Image
            src={photos[0]}
            alt={`${attraction.name} photo 1`}
            fill
            sizes="(min-width: 768px) 700px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </button>

      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`View photo ${index + 1} of ${photos.length}`}
              className="relative h-16 w-20 shrink-0 overflow-hidden rounded-[10px] border border-attraction-border"
            >
              <Image
                src={photo}
                alt={`${attraction.name} thumbnail ${index + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${attraction.name} photo ${lightboxIndex + 1} of ${photos.length}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex(null);
            }}
            aria-label="Close photo viewer"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white transition hover:bg-white/25"
          >
            &times;
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/25 md:left-6"
            >
              &lsaquo;
            </button>
          )}

          <div className="relative h-[70vh] w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={photos[lightboxIndex]}
              alt={`${attraction.name} photo ${lightboxIndex + 1}`}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition hover:bg-white/25 md:right-6"
            >
              &rsaquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function NoPhotoPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] bg-attraction-primary-soft px-6 py-12 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect width="48" height="48" rx="12" className="fill-attraction-primary-soft-strong" />
        <path
          d="M12 34l9-9 6 6 4-4 9 9"
          className="stroke-attraction-primary-muted"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="20" r="4" className="fill-attraction-primary-muted" />
      </svg>
      <p className="text-[15px] font-medium text-attraction-muted">
        No photo available for this attraction
      </p>
    </div>
  );
}
