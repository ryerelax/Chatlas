"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import StarRating from "@/presentation/components/StarRating";
import { BackArrowIcon } from "@/presentation/components/AttractionIcons";
import AttractionMap from "@/presentation/components/AttractionMap";

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
          <AttractionMap attraction={attraction} />

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
