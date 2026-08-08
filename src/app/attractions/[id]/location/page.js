"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StarRating from "@/components/StarRating";
import { BackArrowIcon } from "@/components/AttractionIcons";

export default function AttractionLocationPage() {
  const params = useParams();
  const attractionId = params.id;

  const [attraction, setAttraction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAttraction() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(
          `/api/attractions/${encodeURIComponent(attractionId)}`
        );

        if (response.status === 404) {
          throw new Error("Attraction not found.");
        }

        if (!response.ok) {
          throw new Error("Unable to load attraction details.");
        }

        const result = await response.json();
        setAttraction(result.data);
      } catch (error) {
        console.error("Failed to load attraction:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (attractionId) {
      loadAttraction();
    }
  }, [attractionId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <p className="text-center text-attraction-muted">Loading location...</p>
      </main>
    );
  }

  if (error || !attraction) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-attraction-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-attraction-ink">
            Unable to display location
          </h1>

          <p className="mt-3 text-attraction-error">
            {error || "Attraction not found."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
          >
            Back to Attractions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-attraction-page-bg">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-7 pb-12 md:px-6 lg:px-[38px]">
        <Link
          href={`/attractions/${attractionId}`}
          className="mb-6 inline-flex h-10 items-center gap-2 rounded-full border border-attraction-border bg-white py-0 pl-3 pr-4 text-sm font-semibold text-attraction-body transition hover:bg-attraction-surface-soft"
        >
          <BackArrowIcon />
          Back to {attraction.name}
        </Link>

        <h1 className="mb-5 text-2xl font-bold tracking-tight text-attraction-ink">
          Location
        </h1>

        <div className="flex flex-col gap-5">
          {/*
            TODO: Replace this placeholder canvas with the real Google Maps
            JavaScript API (@react-google-maps/api or similar), centered on
            attraction.latitude/attraction.longitude with a Marker, once the
            Google Cloud project + NEXT_PUBLIC_GOOGLE_MAPS_API_KEY are
            configured. Keep it view-only: Marker + zoom/pan, no Directions
            or search box. Also add a graceful text-fallback (address) for
            when the Maps script fails to load.
          */}
          <MapPlaceholder attraction={attraction} />

          <div className="flex flex-wrap items-center gap-5 rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm">
            <div className="min-w-[260px] flex-1">
              <span className="mb-2 inline-block rounded-full bg-attraction-primary-soft px-2.5 py-1 text-xs font-semibold text-attraction-primary">
                {attraction.category || "Uncategorized"}
              </span>
              <h2 className="mb-1.5 text-lg font-bold leading-snug text-attraction-ink">
                {attraction.name}
              </h2>
              <p className="mb-2 text-sm leading-relaxed text-attraction-body">
                {attraction.address}
              </p>
              <StarRating
                rating={attraction.rating || 0}
                reviewCount={attraction.totalReviews || 0}
              />
            </div>

            <Link
              href={`/attractions/${attractionId}`}
              className="h-[46px] shrink-0 whitespace-nowrap rounded-[10px] border border-attraction-border-strong bg-white px-5 text-[15px] font-semibold leading-[46px] text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
            >
              Back to details
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function MapPlaceholder({ attraction }) {
  const [zoom, setZoom] = useState(14);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  function handlePointerDown(event) {
    isDragging.current = true;
    dragStart.current = { x: event.clientX, y: event.clientY };
    panStart.current = { ...offset };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!isDragging.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    setOffset({ x: panStart.current.x + dx, y: panStart.current.y + dy });
  }

  function handlePointerUp() {
    isDragging.current = false;
  }

  function zoomIn() {
    setZoom((z) => Math.min(z + 1, 18));
  }

  function zoomOut() {
    setZoom((z) => Math.max(z - 1, 8));
  }

  const gridSize = 80 - zoom * 2;
  const tileShiftX = ((offset.x % gridSize) + gridSize) % gridSize;
  const tileShiftY = ((offset.y % gridSize) + gridSize) % gridSize;

  return (
    <div
      className="relative min-h-[420px] touch-none select-none overflow-hidden rounded-[18px] border border-attraction-border"
      style={{ backgroundColor: "#E8F0EA", cursor: "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,108,86,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,108,86,0.07) 1px, transparent 1px)",
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${tileShiftX}px ${tileShiftY}px`,
        }}
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <rect x={`${(offset.x % 9999) - 200}px`} y="47%" width="200%" height="14" fill="white" opacity="0.55" rx="2" />
        <rect x="47%" y={`${(offset.y % 9999) - 200}px`} width="14" height="200%" fill="white" opacity="0.55" rx="2" />
        <rect x={`${(offset.x % 9999) - 200}px`} y="30%" width="200%" height="8" fill="white" opacity="0.35" rx="2" />
        <rect x={`${(offset.x % 9999) - 200}px`} y="68%" width="200%" height="8" fill="white" opacity="0.35" rx="2" />
        <rect x="25%" y={`${(offset.y % 9999) - 200}px`} width="8" height="200%" fill="white" opacity="0.35" rx="2" />
        <rect x="72%" y={`${(offset.y % 9999) - 200}px`} width="8" height="200%" fill="white" opacity="0.35" rx="2" />
        <rect x="52%" y="52%" width="80" height="60" fill="#B7DFBB" opacity="0.5" rx="6" />
        <rect x="18%" y="34%" width="60" height="40" fill="#B7DFBB" opacity="0.4" rx="4" />
      </svg>

      <div
        className="pointer-events-none absolute top-1/2 left-1/2 flex flex-col items-center"
        style={{
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[50%_50%_50%_0] border-[3px] border-white bg-attraction-primary"
          style={{ transform: "rotate(-45deg)", boxShadow: "0 3px 14px rgba(0,108,86,0.45)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ transform: "rotate(45deg)" }}>
            <path d="M9 2a5 5 0 0 1 5 5c0 4-5 9-5 9S4 11 4 7a5 5 0 0 1 5-5z" fill="white" opacity="0.9" />
            <circle cx="9" cy="7" r="2" className="fill-attraction-primary" />
          </svg>
        </div>
        <div className="h-2.5 w-0.5 bg-attraction-primary opacity-60" />
        <div className="h-[3px] w-2 rounded-sm bg-attraction-primary opacity-30" />
      </div>

      <div className="absolute right-4 bottom-4 flex flex-col overflow-hidden rounded-[10px] shadow-lg">
        <button
          type="button"
          onClick={zoomIn}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center bg-white text-lg font-light text-attraction-body transition hover:bg-attraction-surface-soft"
        >
          +
        </button>
        <div className="h-px bg-attraction-divider" />
        <button
          type="button"
          onClick={zoomOut}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center bg-white text-lg font-light text-attraction-body transition hover:bg-attraction-surface-soft"
        >
          &minus;
        </button>
      </div>

      <div className="absolute bottom-2.5 left-3 rounded bg-white/75 px-1.5 py-0.5 text-[11px] text-attraction-muted">
        Map preview · Drag to pan
      </div>

      <div className="absolute top-3 left-3 rounded-full border border-attraction-border bg-white/85 px-2.5 py-1 text-xs font-semibold text-attraction-primary-dark">
        Zoom {zoom}
      </div>

      <div className="absolute top-3 right-3 max-w-[70%] rounded-full border border-attraction-border bg-white/90 px-3 py-1 text-right text-[11px] text-attraction-muted">
        {attraction.address}
      </div>
    </div>
  );
}
