"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ExplorerRankBadge from "@/presentation/components/ExplorerRankBadge";
import Pagination from "@/presentation/components/Pagination";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";
import SocialProfileStatus from "@/presentation/components/SocialProfileStatus";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function SocialProfileDirectory() {
  const { t, translateState } = useLanguage();
  const genericErrorMessage = t("errorGeneric");
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [rankFilter, setRankFilter] = useState("all");
  const [appliedRankFilter, setAppliedRankFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [appliedSort, setAppliedSort] = useState("name");
  const [hasReviews, setHasReviews] = useState(false);
  const [appliedHasReviews, setAppliedHasReviews] = useState(false);
  const [hasProfileDetails, setHasProfileDetails] = useState(false);
  const [appliedHasProfileDetails, setAppliedHasProfileDetails] =
    useState(false);
  const [page, setPage] = useState(1);
  const [searchRequestId, setSearchRequestId] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page) });
    if (appliedSearch) query.set("search", appliedSearch);
    if (appliedRankFilter !== "all") query.set("rank", appliedRankFilter);
    if (appliedSort !== "name") query.set("sort", appliedSort);
    if (appliedHasReviews) query.set("hasReviews", "true");
    if (appliedHasProfileDetails) {
      query.set("hasProfileDetails", "true");
    }

    async function loadProfiles() {
      try {
        const response = await fetch(`/api/profiles?${query.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || genericErrorMessage);
        }

        setProfiles(result.data || []);
        setTotal(result.count || 0);
        setTotalPages(result.pagination?.totalPages || 1);
        setError("");
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadProfiles();
    return () => controller.abort();
  }, [
    appliedHasProfileDetails,
    appliedHasReviews,
    appliedRankFilter,
    appliedSearch,
    appliedSort,
    genericErrorMessage,
    page,
    searchRequestId,
  ]);

  function handleSearch(event) {
    event.preventDefault();
    setIsLoading(true);
    setAppliedSearch(search.trim());
    setAppliedRankFilter(rankFilter);
    setAppliedSort(sort);
    setAppliedHasReviews(hasReviews);
    setAppliedHasProfileDetails(hasProfileDetails);
    setPage(1);
    setSearchRequestId((current) => current + 1);
  }

  function handleReset() {
    const shouldReload =
      Boolean(appliedSearch) ||
      appliedRankFilter !== "all" ||
      appliedSort !== "name" ||
      appliedHasReviews ||
      appliedHasProfileDetails ||
      page !== 1;

    setSearch("");
    setAppliedSearch("");
    setRankFilter("all");
    setAppliedRankFilter("all");
    setSort("name");
    setAppliedSort("name");
    setHasReviews(false);
    setAppliedHasReviews(false);
    setHasProfileDetails(false);
    setAppliedHasProfileDetails(false);
    setShowMoreFilters(false);
    setPage(1);
    if (shouldReload) setIsLoading(true);
  }

  function changePage(nextPage) {
    setIsLoading(true);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <section className="bg-[#0F5A43] text-white">
        <div className="mx-auto max-w-[1120px] px-4 py-11 md:px-6 lg:px-[38px] lg:py-14">
          <p className="mb-4 font-semibold text-white/85">
            {t("travellersHeroEyebrow")}
          </p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white md:text-5xl">
            {t("travellersHeroTitle")}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80">
            {t("travellersHeroDescription")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 py-10 md:px-6 lg:px-[38px]">
        <form
          onSubmit={handleSearch}
          className="relative z-10 -mt-16 mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg"
        >
          <label
            htmlFor="profile-search"
            className="mb-2 block font-semibold text-gray-900"
          >
            {t("searchTravellers")}
          </label>

          <div className="grid gap-3 lg:grid-cols-[2fr_auto_auto_auto]">
            <input
              id="profile-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchTravellers")}
              maxLength={80}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
            />

            <button
              type="button"
              onClick={() => setShowMoreFilters((current) => !current)}
              aria-expanded={showMoreFilters}
              aria-controls="traveller-filters"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-emerald-600 hover:text-emerald-700"
            >
              {showMoreFilters ? t("hideFilters") : t("moreFilters")}
            </button>

            <button
              type="submit"
              className="rounded-lg bg-amber-400 px-6 py-3 font-semibold text-gray-900 transition hover:bg-amber-500"
            >
              {t("search")}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              {t("reset")}
            </button>
          </div>

          {showMoreFilters && (
            <div
              id="traveller-filters"
              className="mt-5 grid gap-5 border-t border-gray-200 pt-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <label
                  htmlFor="explorer-rank-filter"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  {t("explorerRankFilter")}
                </label>
                <select
                  id="explorer-rank-filter"
                  value={rankFilter}
                  onChange={(event) => setRankFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
                >
                  <option value="all">{t("allExplorerRanks")}</option>
                  <option value="new">{t("rankNewExplorer")}</option>
                  <option value="bronze">{t("rankBronzeExplorer")}</option>
                  <option value="silver">{t("rankSilverExplorer")}</option>
                  <option value="gold">{t("rankGoldExplorer")}</option>
                  <option value="master">{t("rankMelakaMaster")}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="traveller-sort"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  {t("sortBy")}
                </label>
                <select
                  id="traveller-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-emerald-500"
                >
                  <option value="name">{t("travellerSortName")}</option>
                  <option value="most-explored">
                    {t("travellerSortMostExplored")}
                  </option>
                  <option value="most-reviews">
                    {t("travellerSortMostReviews")}
                  </option>
                  <option value="newest-members">
                    {t("travellerSortNewestMembers")}
                  </option>
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-gray-800">
                  {t("quickFilters")}
                </legend>
                <div className="space-y-3 rounded-lg border border-gray-200 px-4 py-3">
                  <label className="flex min-h-6 cursor-pointer items-center gap-3 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={hasReviews}
                      onChange={(event) => setHasReviews(event.target.checked)}
                      className="h-4 w-4 accent-emerald-700"
                    />
                    {t("hasReviews")}
                  </label>
                  <label className="flex min-h-6 cursor-pointer items-center gap-3 text-sm font-medium text-gray-800">
                    <input
                      type="checkbox"
                      checked={hasProfileDetails}
                      onChange={(event) =>
                        setHasProfileDetails(event.target.checked)
                      }
                      className="h-4 w-4 accent-emerald-700"
                    />
                    {t("hasProfileDetails")}
                  </label>
                </div>
              </fieldset>
            </div>
          )}
        </form>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-attraction-ink">
              {t("travellersTitle")}
            </h2>
            {!isLoading && !error && (
              <p className="mt-1 text-sm text-attraction-muted">
                {total} {t("publicProfile")}
                {appliedSearch ? ` — “${appliedSearch}”` : ""}
              </p>
            )}
          </div>
        </div>

        {isLoading && <DirectorySkeleton t={t} />}

        {!isLoading && error && (
          <SocialProfileStatus
            icon="!"
            title={t("errorGeneric")}
            message={error}
            tone="error"
          />
        )}

        {!isLoading && !error && profiles.length === 0 && (
          <SocialProfileStatus
            icon="?"
            title={t("noTravellersFound")}
            message={t("tryChangingFilters")}
          />
        )}

        {!isLoading && !error && profiles.length > 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                t={t}
                translateState={translateState}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={changePage}
            ariaLabel={t("travellersTitle")}
            getPageAriaLabel={(pageNumber) =>
              t("travellersGoToPage", { page: pageNumber })
            }
            previousLabel={t("previous")}
            nextLabel={t("next")}
          />
        )}
      </section>
    </main>
  );
}

function ProfileCard({ profile, t, translateState }) {
  const hasLocation = Boolean(profile.location?.trim());
  const hasBio = Boolean(profile.bio?.trim());
  const locationLabel = hasLocation
    ? translateState
      ? translateState(profile.location)
      : profile.location
    : "";
  const bioLabel = hasBio
    ? profile.bio
    : hasLocation
      ? t("noBioAddedYet")
      : t("noProfileDetailsYet");

  return (
    <article className="flex h-full min-w-0 max-w-full flex-col rounded-[14px] border border-attraction-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-4">
        <ProfileAvatar
          name={profile.displayName}
          src={profile.profilePicture}
          size="medium"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-attraction-ink">
            {profile.displayName}
          </h3>
          <div className="mt-1 flex">
            <ExplorerRankBadge rank={profile.activitySummary?.rank} />
          </div>
          <p
            className="mt-1 min-h-5 truncate text-sm text-attraction-muted"
            aria-hidden={hasLocation ? undefined : "true"}
          >
            {locationLabel}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 flex-1 break-words text-sm leading-relaxed text-attraction-body">
        {bioLabel}
      </p>
      <Link
        href={`/profiles/${profile.id}`}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-attraction-border-strong text-sm font-semibold text-attraction-primary-dark transition hover:bg-attraction-primary-soft"
      >
        {t("viewProfile")}
      </Link>
    </article>
  );
}

function DirectorySkeleton({ t }) {
  return (
    <div
      className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={t("loading")}
    >
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={item}
          className="h-52 min-w-0 max-w-full animate-pulse rounded-[14px] border border-attraction-border bg-white p-5"
        >
          <div className="flex gap-4">
            <div className="h-14 w-14 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2 pt-2">
              <div className="h-4 rounded bg-gray-200" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-5 h-14 rounded bg-gray-100" />
          <div className="mt-4 h-11 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
