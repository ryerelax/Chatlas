"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReviewForm from "@/presentation/components/reviews/ReviewForm";
import ReviewList from "@/presentation/components/reviews/ReviewList";
import StarRating from "@/presentation/components/StarRating";
import { BackArrowIcon, LocationPinIcon } from "@/presentation/components/AttractionIcons";
import AttractionPhotoGallery from "@/presentation/components/AttractionPhotoGallery";

export default function AttractionDetailsPage() {
  const params = useParams();
  const attractionId = params.id;

  const [attraction, setAttraction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewRefreshVersion, setReviewRefreshVersion] = useState(0);

  useEffect(() => {
    async function loadAttractionDetails() {
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
        console.error("Failed to load attraction details:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (attractionId) {
      loadAttractionDetails();
    }
  }, [attractionId]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <p className="text-center text-attraction-muted">
          Loading attraction details...
        </p>
      </main>
    );
  }

  if (error || !attraction) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-attraction-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-attraction-ink">
            Unable to display attraction
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

  const hasDescription = attraction.description && attraction.description.trim().length > 0;

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <div className="mx-auto max-w-[1120px] px-4 py-8 pb-16 md:px-6 lg:px-[38px]">
        <Link
          href="/"
          className="mb-7 inline-flex h-10 items-center gap-2 rounded-full border border-attraction-border bg-white py-0 pl-3 pr-4 text-sm font-semibold text-attraction-body transition hover:border-attraction-border-strong hover:bg-attraction-surface-soft"
        >
          <BackArrowIcon />
          Back to attractions
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left column */}
          <div>
            <div className="mb-5">
              <span className="mb-3 inline-block rounded-full bg-attraction-primary-soft px-3 py-1 text-[13px] font-semibold text-attraction-primary">
                {attraction.category || "Uncategorized"}
              </span>

              <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-attraction-ink md:text-3xl lg:text-4xl">
                {attraction.name}
              </h1>

              <div className="flex flex-wrap items-center gap-4">
                <StarRating
                  rating={attraction.rating || 0}
                  reviewCount={attraction.totalReviews || 0}
                  size={16}
                />
                {/* TODO: Show a Location Area pin once the schema/data supports a district field. */}
              </div>
            </div>

            <AttractionPhotoGallery attraction={attraction} />

            <div className="mt-7 rounded-[18px] border border-attraction-border bg-white p-6">
              <h2 className="mb-3.5 text-lg font-bold text-attraction-ink">
                About this attraction
              </h2>
              <p
                className={
                  hasDescription
                    ? "text-base leading-relaxed text-attraction-body"
                    : "text-base italic leading-relaxed text-attraction-muted"
                }
              >
                {hasDescription ? attraction.description : "No description available for this attraction yet."}
              </p>
            </div>

            {/* TODO: Link to the Review & Community module once that route ships. */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-attraction-surface-soft p-5">
              <div>
                <p className="mb-0.5 text-sm font-semibold text-attraction-ink">
                  Community reviews
                </p>
                <p className="text-[13px] text-attraction-muted">
                  Read what travellers say about this attraction
                </p>
              </div>
              <button
                type="button"
                disabled
                title="Coming soon"
                className="h-9 shrink-0 whitespace-nowrap rounded-[10px] border border-attraction-border-strong bg-white px-4 text-[13px] font-semibold text-attraction-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                View reviews
              </button>
            </div>
            {/* Review & Community Section */}
            <section className="mt-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-attraction-ink">
                    Community Reviews
                  </h2>

                  <p className="mt-1 text-sm text-attraction-muted">
                    See what other travellers say about this attraction.
                  </p>
                </div>
              </div>

              <ReviewForm
                attractionId={attractionId}
                onReviewSubmitted={() =>
                  setReviewRefreshVersion((version) => version + 1)
                }
              />
              <ReviewList
                attractionId={attractionId}
                refreshVersion={reviewRefreshVersion}
              />
            </section>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-attraction-ink">
                Attraction details
              </h2>

              <InfoRow
                icon={<CategoryIcon />}
                label="Category"
                value={attraction.category || "Uncategorized"}
              />
              <Divider />
              <InfoRow
                icon={<LocationPinIcon />}
                label="Address"
                value={attraction.address}
              />
              <Divider />
              <InfoRow
                icon={<StarIcon />}
                label="Rating"
                value={`${(attraction.rating || 0).toFixed(1)} out of 5 (${(attraction.totalReviews || 0).toLocaleString()} reviews)`}
              />
            </div>

            <Link
              href={`/attractions/${attractionId}/location`}
              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-attraction-primary text-[15px] font-semibold text-white transition hover:bg-attraction-primary-hover"
            >
              <LocationPinIcon />
              View location on map
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Divider() {
  return <div className="my-3.5 border-t border-attraction-divider" />;
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-attraction-primary-soft text-attraction-primary">
        {icon}
      </div>
      <div>
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-attraction-muted">
          {label}
        </p>
        <p className="text-sm leading-relaxed text-attraction-body">{value}</p>
      </div>
    </div>
  );
}

function CategoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l1.5 3.1 3.4.5-2.45 2.4.58 3.38L8 9.32l-3.03 1.58.58-3.38L3.1 5.1l3.4-.5z"
        fill="currentColor"
      />
    </svg>
  );
}
