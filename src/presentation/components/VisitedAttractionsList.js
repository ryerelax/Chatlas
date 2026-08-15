"use client";

import Link from "next/link";
import {
  getAttractionDetailsHref,
  getVisitedAuthenticationPresentation,
} from "@/presentation/lib/explorationMapPresentation";

function LoadingState() {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#405066]">
        Loading visited attractions...
      </p>

      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-[#E8EDF1] bg-white p-4"
          >
            <div className="h-4 w-36 animate-pulse rounded bg-[#DCE8E3]" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#E8EDF1]" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[#E8EDF1]" />
            <div className="mt-5 flex gap-3">
              <div className="h-11 w-28 animate-pulse rounded-xl bg-[#E6F7F0]" />
              <div className="h-11 w-24 animate-pulse rounded-xl bg-[#E8EDF1]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StateMessage({
  title,
  description,
  tone = "neutral",
  actionHref,
  actionLabel,
  onRetry,
}) {
  const isError = tone === "error";

  return (
    <div
      className={`rounded-2xl border px-5 py-6 text-center ${
        isError
          ? "border-[#F0C8C5] bg-[#FFF9F8]"
          : "border-[#D8E1E7] bg-white"
      }`}
    >
      <span
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
          isError
            ? "bg-[#FBE9E8] text-[#A43D36]"
            : "bg-[#E6F7F0] text-[#006C56]"
        }`}
        aria-hidden="true"
      >
        {isError ? "!" : "i"}
      </span>
      <p className="mt-3 font-semibold text-[#10213B]">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#65748A]">
        {description}
      </p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#006C56] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#005E4B] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
        >
          {actionLabel}
        </Link>
      )}
      {typeof onRetry === "function" && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-xl border border-[#BBC8D0] bg-white px-4 py-2.5 text-sm font-semibold text-[#004638] transition hover:border-[#006C56] hover:bg-[#E6F7F0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function getLiveAnnouncement(status, attractions, message) {
  if (status === "loading") {
    return "Loading visited attractions.";
  }

  if (status === "error") {
    return message || "Visited attractions could not be loaded.";
  }

  if (status === "auth-required") {
    return message || "Sign in to view your verified visits.";
  }

  if (status === "unavailable") {
    return message || "Visited attraction data is unavailable.";
  }

  if (status === "success" && attractions.length === 0) {
    return "No visited attractions yet.";
  }

  if (status === "success") {
    return `${attractions.length} visited attraction${
      attractions.length === 1 ? "" : "s"
    } loaded.`;
  }

  return "Visited attraction data is unavailable.";
}

export default function VisitedAttractionsList({
  status,
  attractions,
  mapStatus,
  message = "",
  onFocusAttraction,
  onRetry,
}) {
  const hasValidAttractions = Array.isArray(attractions);
  const visitedAttractions = hasValidAttractions ? attractions : [];
  const displayStatus =
    status === "success" && !hasValidAttractions ? "unavailable" : status;
  const canFocusMap =
    mapStatus === "ready" && typeof onFocusAttraction === "function";
  const announcement = getLiveAnnouncement(
    displayStatus,
    visitedAttractions,
    message
  );
  const authenticationPresentation =
    getVisitedAuthenticationPresentation(displayStatus);

  return (
    <section
      className="rounded-2xl border border-[#D8E1E7] bg-[#F8FBFA] p-4 shadow-sm sm:p-5"
      aria-labelledby="visited-attractions-heading"
      aria-busy={displayStatus === "loading"}
    >
      <p
        className="sr-only"
        role={displayStatus === "error" ? "alert" : "status"}
        aria-live={displayStatus === "error" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {announcement}
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#006C56]">
            Personal exploration
          </p>
          <h3
            id="visited-attractions-heading"
            className="mt-1 text-lg font-bold text-[#10213B]"
          >
            Visited attractions
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#65748A]">
            Places confirmed by your verified visits.
          </p>
        </div>

        {displayStatus === "success" && (
          <span className="w-fit rounded-full border border-[#BDE8D7] bg-[#E6F7F0] px-3 py-1.5 text-xs font-semibold text-[#004638]">
            {visitedAttractions.length} visited
          </span>
        )}
      </div>

      {displayStatus === "loading" && <LoadingState />}

      {authenticationPresentation && (
        <StateMessage
          title="Sign in to view visited attractions"
          description={message || authenticationPresentation.message}
          actionHref={authenticationPresentation.signInHref}
          actionLabel={authenticationPresentation.signInLabel}
        />
      )}

      {displayStatus === "unavailable" && (
        <StateMessage
          title="Visited data unavailable"
          description={
            message ||
            "Your visited attractions are not available right now."
          }
          onRetry={onRetry}
        />
      )}

      {displayStatus === "error" && (
        <StateMessage
          title="Could not load visited attractions"
          description={
            message ||
            "We could not load your visited attractions. Please try again."
          }
          tone="error"
          onRetry={onRetry}
        />
      )}

      {displayStatus === "success" && visitedAttractions.length === 0 && (
        <StateMessage
          title="No visited attractions yet"
          description="Attractions confirmed through a verified visit will appear in this list."
        />
      )}

      {displayStatus === "success" && visitedAttractions.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visitedAttractions.map((attraction) => (
            <li
              key={attraction.id}
              className="rounded-2xl border border-[#D8E1E7] bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F7F0] text-[#006C56]"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path
                      d="m5 10 3 3 7-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[#10213B]">
                    {attraction.name}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[#65748A]">
                    {attraction.address}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-[#F1F6F4] px-2.5 py-1 text-xs font-semibold text-[#405066]">
                    {attraction.category}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onFocusAttraction(attraction)}
                  disabled={!canFocusMap}
                  aria-label={`Focus ${attraction.name} on map`}
                  title={
                    canFocusMap
                      ? undefined
                      : "Available when the interactive map is ready"
                  }
                  className="min-h-11 rounded-xl border border-[#BBC8D0] bg-white px-3.5 py-2 text-sm font-semibold text-[#004638] transition hover:border-[#006C56] hover:bg-[#E6F7F0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56] disabled:cursor-not-allowed disabled:border-[#D8E1E7] disabled:bg-[#F1F3F5] disabled:text-[#7A8797]"
                >
                  Focus on map
                </button>
                <Link
                  href={getAttractionDetailsHref(attraction.id)}
                  aria-label={`View details for ${attraction.name}`}
                  className="inline-flex min-h-11 items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-[#006C56] underline-offset-4 hover:bg-[#E6F7F0] hover:underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
                >
                  View details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!["loading", "auth-required", "unavailable", "error", "success"].includes(
        displayStatus
      ) && (
        <StateMessage
          title="Visited data unavailable"
          description={
            message || "Visited attraction data is not available right now."
          }
        />
      )}
    </section>
  );
}
