"use client";
//hi

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AttractionDetailsPage() {
  const params = useParams();
  const attractionId = params.id;

  const [attraction, setAttraction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      <main className="min-h-screen bg-gray-50 px-6 py-16">
        <p className="text-center text-gray-600">
          Loading attraction details...
        </p>
      </main>
    );
  }

  if (error || !attraction) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Unable to display attraction
          </h1>

          <p className="mt-3 text-red-600">
            {error || "Attraction not found."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Back to Attractions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-block font-semibold text-emerald-700 hover:underline"
        >
          ← Back to Attractions
        </Link>

        {/* TODO: Replace this placeholder with attraction photos or an image gallery. */}
        <div className="flex h-72 items-center justify-center rounded-t-2xl bg-gray-200">
          <span className="text-7xl">📍</span>
        </div>

        {/* TODO: Personalize this page using the final Chatlas branding and layout. */}
        <article className="rounded-b-2xl border border-t-0 border-gray-200 bg-white p-8 shadow-sm">
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
            {attraction.category || "Uncategorized"}
          </span>

          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            {attraction.name}
          </h1>

          <p className="mt-3 text-gray-600">
            {attraction.address}
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <div className="rounded-lg bg-amber-50 px-4 py-3">
              <p className="text-sm text-gray-500">Rating</p>
              <p className="font-bold text-amber-600">
                ★ {attraction.rating || 0}
              </p>
            </div>

            <div className="rounded-lg bg-gray-100 px-4 py-3">
              <p className="text-sm text-gray-500">Reviews</p>
              <p className="font-bold text-gray-900">
                {attraction.totalReviews || 0}
              </p>
            </div>

            <div className="rounded-lg bg-gray-100 px-4 py-3">
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-bold text-gray-900">
                {attraction.businessStatus || "Unknown"}
              </p>
            </div>
          </div>

          {attraction.types?.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-gray-900">
                Attraction Types
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {attraction.types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700"
                  >
                    {type.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* TODO: Embed an interactive map here using the chosen mapping component. */}
          {attraction.googleMapsUrl && (
            <a
              href={attraction.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              View on Google Maps
            </a>
          )}
        </article>
      </div>
    </main>
  );
}