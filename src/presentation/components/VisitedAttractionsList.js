"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import {
  createVisitedVerificationPresentation,
  getVisitedAttractionsCopy,
  paginateVisitedAttractions,
  sortVisitedAttractions,
  VISITED_ATTRACTIONS_SORT,
} from "@/presentation/lib/visitedAttractionsAdapter";
import {
  getAttractionDetailsHref,
  getVisitedAuthenticationPresentation,
} from "@/presentation/lib/explorationMapPresentation";

function LoadingState({ t }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-[#405066]">
        {t("loadingVisited")}
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
  t,
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
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

function getLiveAnnouncement(status, attractions, message, t) {
  if (status === "loading") {
    return t("loadingVisited");
  }

  if (status === "error") {
    return message || t("couldNotLoadVisited");
  }

  if (status === "auth-required") {
    return message || t("signInViewVisited");
  }

  if (status === "unavailable") {
    return message || t("visitedDataUnavailable");
  }

  if (status === "success" && attractions.length === 0) {
    return t("noVisitedYet");
  }

  if (status === "success") {
    return t("visitedCountLabel", { count: attractions.length });
  }

  return t("visitedDataUnavailable");
}

export default function VisitedAttractionsList({
  status,
  attractions,
  mapStatus,
  message = "",
  onFocusAttraction,
  onRetry,
}) {
  const { lang, t } = useLanguage();
  const hasValidAttractions = Array.isArray(attractions);
  const visitedAttractions = useMemo(
    () => (hasValidAttractions ? attractions : []),
    [attractions, hasValidAttractions]
  );
  const displayStatus =
    status === "success" && !hasValidAttractions ? "unavailable" : status;
  const canFocusMap =
    mapStatus === "ready" && typeof onFocusAttraction === "function";
  const [sort, setSort] = useState(VISITED_ATTRACTIONS_SORT.MOST_RECENT);
  const [page, setPage] = useState(1);
  const copy = getVisitedAttractionsCopy(lang);
  const sortedAttractions = useMemo(
    () => sortVisitedAttractions(visitedAttractions, sort, lang),
    [lang, visitedAttractions, sort]
  );
  const pagination = paginateVisitedAttractions(sortedAttractions, page);
  const announcement = getLiveAnnouncement(
    displayStatus,
    visitedAttractions,
    message,
    t
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
            {t("personalExploration")}
          </p>
          <h3
            id="visited-attractions-heading"
            className="mt-1 text-lg font-bold text-[#10213B]"
          >
            {t("visitedAttractions")}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#65748A]">
            {t("visitedConfirmedHint")}
          </p>
        </div>

        {displayStatus === "success" && (
          <span className="w-fit rounded-full border border-[#BDE8D7] bg-[#E6F7F0] px-3 py-1.5 text-xs font-semibold text-[#004638]">
            {t("visitedCountLabel", { count: visitedAttractions.length })}
          </span>
        )}
      </div>

      {displayStatus === "loading" && <LoadingState t={t} />}

      {authenticationPresentation && (
        <StateMessage
          title={t("signInViewVisited")}
          description={t("signInViewVisitedHint")}
          actionHref={authenticationPresentation.signInHref}
          actionLabel={t("signIn")}
          t={t}
        />
      )}

      {displayStatus === "unavailable" && (
        <StateMessage
          title={t("visitedDataUnavailable")}
          description={message || t("visitedUnavailableHint")}
          onRetry={onRetry}
          t={t}
        />
      )}

      {displayStatus === "error" && (
        <StateMessage
          title={t("couldNotLoadVisited")}
          description={message || t("couldNotLoadVisitedHint")}
          tone="error"
          onRetry={onRetry}
          t={t}
        />
      )}

      {displayStatus === "success" && visitedAttractions.length === 0 && (
        <StateMessage
          title={t("noVisitedYet")}
          description={t("visitedListHint")}
          t={t}
        />
      )}

      {displayStatus === "success" && visitedAttractions.length > 0 && (
        <>
          <label className="mb-4 block text-sm font-semibold text-[#405066]">
            {copy.sortBy}
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="mt-1 block min-h-11 w-full rounded-xl border border-[#BBC8D0] bg-white px-3"
            >
              <option value={VISITED_ATTRACTIONS_SORT.MOST_RECENT}>
                {copy.mostRecent}
              </option>
              <option value={VISITED_ATTRACTIONS_SORT.OLDEST}>
                {copy.oldest}
              </option>
              <option value={VISITED_ATTRACTIONS_SORT.NAME_ASC}>
                {copy.nameAsc}
              </option>
            </select>
          </label>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pagination.items.map((attraction) => {
              const verificationPresentation =
                createVisitedVerificationPresentation(attraction, lang);

              return (
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
                  <p className="mt-3 text-sm text-[#65748A]">
                    {verificationPresentation.label}:{" "}
                    {verificationPresentation.value}
                    {verificationPresentation.timeUnavailable && (
                      <> · {verificationPresentation.timeUnavailableLabel}</>
                    )}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onFocusAttraction(attraction)}
                      disabled={!canFocusMap}
                      aria-label={`${t("focusOnMap")}: ${attraction.name}`}
                      title={canFocusMap ? undefined : t("mapNotReady")}
                      className="min-h-11 rounded-xl border border-[#BBC8D0] bg-white px-3.5 py-2 text-sm font-semibold text-[#004638] transition hover:border-[#006C56] hover:bg-[#E6F7F0] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56] disabled:cursor-not-allowed disabled:border-[#D8E1E7] disabled:bg-[#F1F3F5] disabled:text-[#7A8797]"
                    >
                      {t("focusOnMap")}
                    </button>
                    <Link
                      href={getAttractionDetailsHref(attraction.id)}
                      aria-label={`${t("viewDetails")}: ${attraction.name}`}
                      className="inline-flex min-h-11 items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-[#006C56] underline-offset-4 hover:bg-[#E6F7F0] hover:underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#006C56]"
                    >
                      {t("viewDetails")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {sortedAttractions.length > 10 && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                disabled={pagination.page === 1}
                onClick={() => setPage(pagination.page - 1)}
                className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
              >
                {t("previous")}
              </button>
              <span aria-live="polite">
                {t("pageOf", {
                  page: pagination.page,
                  total: pagination.totalPages,
                })}
              </span>
              <button
                type="button"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
                className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}

      {!["loading", "auth-required", "unavailable", "error", "success"].includes(
        displayStatus
      ) && (
        <StateMessage
          title={t("visitedDataUnavailable")}
          description={message || t("visitedUnavailableHint")}
          t={t}
        />
      )}
    </section>
  );
}