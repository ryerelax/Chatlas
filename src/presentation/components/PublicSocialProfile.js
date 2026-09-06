"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ExplorerRankBadge from "@/presentation/components/ExplorerRankBadge";
import Pagination from "@/presentation/components/Pagination";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";
import SocialExplorationMap from "@/presentation/components/SocialExplorationMap";
import SocialProfileStatus from "@/presentation/components/SocialProfileStatus";
import StarRating from "@/presentation/components/StarRating";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import { formatLocaleDate } from "@/presentation/lib/formatLocaleDate";

const TAB_IDS = ["overview", "reviews", "exploration", "compare"];
const PUBLIC_REVIEWS_PAGE_SIZE = 5;
const VERIFIED_LOCATIONS_PAGE_SIZE = 12;
const COMPARISON_LOCATIONS_PAGE_SIZE = 8;

export default function PublicSocialProfile() {
  const { id } = useParams();
  const { status } = useSession();
  const { t, translateState, lang } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState("loading");
  const [profileError, setProfileError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [sectionState, setSectionState] = useState({
    status: "idle",
    data: null,
    message: "",
    code: "",
  });

  const tabs = [
    { id: "overview", label: t("overview") },
    { id: "reviews", label: t("community") },
    { id: "exploration", label: t("exploreProgressTab") },
    { id: "compare", label: t("compare") },
  ];

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || t("profileDoesNotExist"));
        }

        setProfile(result.data);
        setProfileState("ready");
      } catch (error) {
        if (error.name !== "AbortError") {
          setProfileError(error.message);
          setProfileState("error");
        }
      }
    }

    loadProfile();
    return () => controller.abort();
  }, [id, t]);

  useEffect(() => {
    if (activeTab === "overview") return;
    if (
      (activeTab === "exploration" || activeTab === "compare") &&
      status !== "authenticated"
    ) {
      return;
    }

    const controller = new AbortController();
    const sectionPath = {
      reviews: "reviews",
      exploration: "exploration",
      compare: "comparison",
    }[activeTab];

    async function loadSection() {
      try {
        const response = await fetch(
          `/api/profiles/${encodeURIComponent(id)}/${sectionPath}`,
          { signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok) {
          setSectionState({
            status: "error",
            data: null,
            message: result.message || t("sectionUnavailable"),
            code: result.code || "",
          });
          return;
        }

        setSectionState({
          status: "ready",
          data: result.data,
          message: "",
          code: "",
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setSectionState({
            status: "error",
            data: null,
            message: t("sectionUnavailable"),
            code: "",
          });
        }
      }
    }

    loadSection();
    return () => controller.abort();
  }, [activeTab, id, status, t]);

  function selectTab(tabId) {
    setActiveTab(tabId);
    setSectionState({
      status: tabId === "overview" ? "idle" : "loading",
      data: null,
      message: "",
      code: "",
    });
  }

  if (profileState === "loading") return <ProfileSkeleton />;

  if (profileState === "error" || !profile) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <SocialProfileStatus
            icon="!"
            title={t("profileNotFound")}
            message={profileError || t("profileDoesNotExist")}
            actionHref="/profiles"
            actionLabel={t("browseTravellers")}
            tone="error"
          />
        </div>
      </main>
    );
  }

  const locationLabel = profile.location
    ? translateState
      ? translateState(profile.location)
      : profile.location
    : t("locationNotShared");

  const joinedLabel = profile.joinedAt
    ? t("memberSince", { date: formatJoinedAt(profile.joinedAt, lang) })
    : t("memberSinceUnavailable");

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <div className="mx-auto max-w-[1120px] px-4 py-8 pb-16 md:px-6 lg:px-[38px]">
        <Link
          href="/profiles"
          className="inline-flex min-h-11 items-center rounded-full border border-attraction-border bg-white px-4 text-sm font-semibold text-attraction-body transition hover:bg-attraction-surface-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
        >
          ← {t("backToTravellers")}
        </Link>

        <section className="mt-5 rounded-[18px] border border-attraction-border bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileAvatar
              name={profile.displayName}
              src={profile.profilePicture}
              size="large"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-attraction-primary">
                {t("publicTravellerProfile")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="min-w-0 text-3xl font-bold tracking-tight text-attraction-ink">
                  {profile.displayName}
                </h1>
                <ExplorerRankBadge rank={profile.activitySummary?.rank} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-attraction-muted">
                <span>{locationLabel}</span>
                <span>{joinedLabel}</span>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-attraction-body">
                {profile.bio || t("noPublicBio")}
              </p>
            </div>
          </div>
        </section>

        <nav
          className="mt-6 overflow-x-auto border-b border-attraction-divider"
          aria-label={t("publicTravellerProfile")}
        >
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`min-h-11 border-b-2 px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-attraction-primary ${
                  activeTab === tab.id
                    ? "border-attraction-primary text-attraction-primary-dark"
                    : "border-transparent text-attraction-muted hover:text-attraction-ink"
                }`}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <section className="mt-6 rounded-[18px] border border-attraction-border bg-white p-5 md:p-6">
          {activeTab === "overview" && (
            <OverviewSection profile={profile} t={t} />
          )}
          {activeTab === "reviews" && (
            <ReviewsSection
              key={profile.id}
              state={sectionState}
              t={t}
              lang={lang}
              travellerName={profile.displayName}
            />
          )}
          {activeTab === "exploration" && (
            <ExplorationProgressSection
              key={profile.id}
              authStatus={status}
              state={sectionState}
              t={t}
            />
          )}
          {activeTab === "compare" && (
            <ComparisonSection
              authStatus={status}
              profile={profile}
              state={sectionState}
              t={t}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function OverviewSection({ profile, t }) {
  return (
    <div>
      <div>
        <p className="text-sm font-semibold text-attraction-primary">
          {t("travelActivity")}
        </p>
        <h2 className="mt-1 text-xl font-bold text-attraction-ink">
          {t("publicActivitySummary")}
        </h2>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label={t("reviewsWritten")}
          value={profile.activitySummary.reviewsWritten}
        />
        <SummaryCard
          label={t("attractionsVisited")}
          value={profile.activitySummary.visitedAttractions}
        />
        <SummaryCard
          label={t("exploreProgress")}
          value={profile.activitySummary.explorationProgress}
          suffix="%"
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, suffix = "" }) {
  return (
    <div className="rounded-[14px] bg-attraction-primary-soft p-5">
      <p className="text-2xl font-bold text-attraction-primary-dark">
        {value === null || value === undefined ? "—" : `${value}${suffix}`}
      </p>
      <p className="mt-1 text-sm text-attraction-body">{label}</p>
    </div>
  );
}

function ReviewsSection({ state, t, lang, travellerName }) {
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const reviews = Array.isArray(state.data) ? state.data : [];
  const sortedReviews = [...reviews].sort((firstReview, secondReview) => {
    const firstDate = getReviewTimestamp(firstReview.createdAt);
    const secondDate = getReviewTimestamp(secondReview.createdAt);
    const firstRating = Number(firstReview.rating) || 0;
    const secondRating = Number(secondReview.rating) || 0;

    if (sort === "oldest") return firstDate - secondDate;
    if (sort === "highest-rating") {
      return secondRating - firstRating || secondDate - firstDate;
    }
    if (sort === "lowest-rating") {
      return firstRating - secondRating || secondDate - firstDate;
    }
    return secondDate - firstDate;
  });
  const totalPages = Math.max(
    1,
    Math.ceil(sortedReviews.length / PUBLIC_REVIEWS_PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PUBLIC_REVIEWS_PAGE_SIZE;
  const visibleReviews = sortedReviews.slice(
    pageStart,
    pageStart + PUBLIC_REVIEWS_PAGE_SIZE
  );

  const sortOptions = [
    { value: "newest", label: t("publicReviewSortNewest") },
    { value: "oldest", label: t("publicReviewSortOldest") },
    { value: "highest-rating", label: t("publicReviewSortHighestRating") },
    { value: "lowest-rating", label: t("publicReviewSortLowestRating") },
  ];
  const reviewsTitle = t("reviewsByTraveller", { name: travellerName });

  function handleSortChange(event) {
    setSort(event.target.value);
    setPage(1);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    document
      .getElementById("public-reviews-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (state.status === "loading") {
    return <SectionSkeleton label={t("loading")} />;
  }
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="i"
        title={
          state.code === "REVIEWS_UNAVAILABLE"
            ? t("reviewsUnavailable")
            : t("unableLoadReviews")
        }
        message={state.message}
        tone={state.code === "REVIEWS_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  if (reviews.length === 0) {
    return (
      <SocialProfileStatus
        icon="☆"
        title={t("noReviewsAvailable")}
        message={t("noReviewsPublished")}
      />
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2
          id="public-reviews-heading"
          className="min-w-0 flex-1 text-2xl font-bold text-attraction-ink [overflow-wrap:anywhere]"
        >
          {reviewsTitle}
        </h2>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="public-review-sort"
            className="mb-1.5 block text-sm font-semibold text-attraction-ink"
          >
            {t("sortBy")}
          </label>
          <select
            id="public-review-sort"
            value={sort}
            onChange={handleSortChange}
            className="min-h-11 w-full rounded-[10px] border border-attraction-border-strong bg-white px-3 text-sm font-medium text-attraction-body focus:border-attraction-primary focus:outline-none focus:ring-2 focus:ring-attraction-primary/30 sm:min-w-48"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 divide-y divide-attraction-divider">
        {visibleReviews.map((review) => (
          <article key={review.id} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StarRating rating={Number(review.rating) || 0} />
              <time className="text-xs text-attraction-muted">
                {formatReviewDate(review.createdAt, lang, t)}
              </time>
            </div>
            {review.attraction?.id && review.attraction?.name && (
              <Link
                href={`/attractions/${review.attraction.id}`}
                className="mt-3 inline-block font-semibold text-attraction-primary-dark hover:underline"
              >
                {review.attraction.name}
              </Link>
            )}
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-attraction-body">
              {review.text}
            </p>
            {Array.isArray(review.photos) && review.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {review.photos.map((photo, index) => (
                  <div
                    key={photo}
                    className="relative aspect-[4/3] overflow-hidden rounded-[10px]"
                  >
                    <Image
                      src={photo}
                      alt={`${review.attraction?.name || "Attraction"} review photo ${index + 1}`}
                      fill
                      sizes="(min-width: 640px) 220px, 45vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={changePage}
        ariaLabel={reviewsTitle}
        getPageAriaLabel={(pageNumber) =>
          t("publicReviewsGoToPage", { page: pageNumber })
        }
        previousLabel={t("previous")}
        nextLabel={t("next")}
      />
    </div>
  );
}

function getReviewTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function ExplorationProgressSection({ authStatus, state, t }) {
  const [page, setPage] = useState(1);
  const attractions = state.data?.visitedAttractions || [];
  const totalPages = Math.max(
    1,
    Math.ceil(attractions.length / VERIFIED_LOCATIONS_PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * VERIFIED_LOCATIONS_PAGE_SIZE;
  const visibleAttractions = attractions.slice(
    pageStart,
    pageStart + VERIFIED_LOCATIONS_PAGE_SIZE
  );

  function changePage(nextPage) {
    setPage(nextPage);
    document
      .getElementById("verified-locations-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (authStatus === "loading") {
    return <SectionSkeleton label={t("checkingAccess")} />;
  }
  if (authStatus !== "authenticated") {
    return (
      <SocialProfileStatus
        icon="⌖"
        title={t("loginToViewProgress")}
        message={t("loginForExploreMaps")}
        actionHref="/login"
        actionLabel={t("loginWithGoogle")}
        tone="info"
      />
    );
  }
  if (state.status === "loading") {
    return <SectionSkeleton label={t("loadingExploreProgress")} />;
  }
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="⌖"
        title={
          state.code === "EXPLORATION_UNAVAILABLE"
            ? t("exploreProgressNotYet")
            : t("exploreProgressUnavailable")
        }
        message={state.message}
        tone={state.code === "EXPLORATION_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  if (attractions.length === 0) {
    return (
      <div>
        <div className="mb-5 flex justify-end">
          <SummaryCard
            label={t("exploreProgress")}
            value={state.data?.progressPercentage ?? 0}
            suffix="%"
          />
        </div>
        <SocialProfileStatus
          icon="⌖"
          title={t("noVerifiedVisits")}
          message={t("noVerifiedVisitsHint")}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-attraction-ink [overflow-wrap:anywhere]">
            {t("verifiedExplorationMap")}
          </h2>
          <p className="mt-1 text-sm text-attraction-muted">
            {t("verifiedAttractionsCount", { count: attractions.length })}
          </p>
        </div>
        <SummaryCard
          label={t("exploreProgress")}
          value={state.data.progressPercentage}
          suffix="%"
        />
      </div>
      <SocialExplorationMap
        attractions={attractions}
        appearance="comparison"
      />
      <p className="mt-4 rounded-[10px] bg-[#EAF3FA] px-4 py-3 text-sm leading-relaxed text-attraction-body">
        {t("onlyVerifiedShown")}
      </p>
      <ExploredAttractionList
        title={t("verifiedLocations")}
        attractions={visibleAttractions}
        t={t}
        headingId="verified-locations-heading"
      />
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={changePage}
        ariaLabel={t("verifiedLocations")}
        getPageAriaLabel={(pageNumber) =>
          t("verifiedLocationsGoToPage", { page: pageNumber })
        }
        previousLabel={t("previous")}
        nextLabel={t("next")}
      />
    </div>
  );
}

function ComparisonSection({ authStatus, profile, state, t }) {
  if (authStatus === "loading") {
    return <SectionSkeleton label={t("checkingAccess")} />;
  }
  if (authStatus !== "authenticated") {
    return (
      <SocialProfileStatus
        icon="⇄"
        title={t("loginToCompare")}
        message={t("loginToCompareHint", { name: profile.displayName })}
        actionHref="/login"
        actionLabel={t("loginWithGoogle")}
        tone="info"
      />
    );
  }
  if (state.status === "loading") {
    return <SectionSkeleton label={t("comparingPlaces")} />;
  }
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="⇄"
        title={
          state.code === "COMPARISON_UNAVAILABLE"
            ? t("comparisonNotYet")
            : t("unableCompare")
        }
        message={state.message}
        tone={state.code === "COMPARISON_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  const comparison = state.data;
  if (!comparison) return null;
  const viewerAttractions = [
    ...(comparison.common || []),
    ...(comparison.viewerOnly || []),
  ];
  const targetAttractions = [
    ...(comparison.common || []),
    ...(comparison.targetOnly || []),
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-attraction-ink">
        {t("coverageComparison")}
      </h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <CoverageComparisonCard
          user={comparison.viewer}
          label={t("you")}
          t={t}
        />
        <CoverageComparisonCard
          user={comparison.target}
          label={profile.displayName}
          t={t}
        />
      </div>
      <section className="mt-8">
        <h3 className="text-base font-bold text-attraction-ink">
          {t("exploredMaps")}
        </h3>
        <p className="mt-1 text-sm text-attraction-muted">
          {t("exploredMapsHint")}
        </p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <ComparisonMap
            label={t("yourExploredPlaces")}
            attractions={viewerAttractions}
            t={t}
          />
          <ComparisonMap
            label={t("theirExploredPlaces", { name: profile.displayName })}
            attractions={targetAttractions}
            t={t}
          />
        </div>
      </section>
      <div className="mt-8 space-y-7">
        <PaginatedExploredAttractionList
          key={`common-${profile.id}`}
          title={t("exploredByBoth")}
          attractions={comparison.common || []}
          t={t}
          headingId="comparison-common-locations-heading"
        />
        <PaginatedExploredAttractionList
          key={`viewer-${profile.id}`}
          title={t("onlyExploredByYou")}
          attractions={comparison.viewerOnly || []}
          t={t}
          headingId="comparison-viewer-locations-heading"
        />
        <PaginatedExploredAttractionList
          key={`target-${profile.id}`}
          title={t("onlyExploredByThem", { name: profile.displayName })}
          attractions={comparison.targetOnly || []}
          t={t}
          headingId="comparison-target-locations-heading"
        />
      </div>
    </div>
  );
}

function CoverageComparisonCard({ user, label, t }) {
  const coverage = Math.min(
    100,
    Math.max(0, Number(user?.coveragePercentage) || 0)
  );
  const coverageLabel = coverage.toFixed(1);
  return (
    <article className="rounded-[14px] bg-attraction-primary-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-attraction-ink">{label}</h3>
        <span className="text-sm font-semibold text-attraction-primary-dark">
          {coverageLabel}%
        </span>
      </div>
      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-white"
        aria-label={`${label} attraction coverage: ${coverageLabel}%`}
      >
        <div
          className="h-full rounded-full bg-attraction-primary"
          style={{ width: `${coverage}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-attraction-body">
        {t("attractionsExplored", { count: user?.exploredCount || 0 })}
      </p>
    </article>
  );
}

function ComparisonMap({ label, attractions, t }) {
  return (
    <article className="rounded-[16px] border border-attraction-border bg-attraction-surface-soft p-4">
      <div className="mb-3 grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <h4
          className="line-clamp-2 min-w-0 font-bold leading-6 text-attraction-ink [overflow-wrap:anywhere]"
          title={label}
        >
          {label}
        </h4>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-right text-xs font-semibold text-attraction-muted">
          {t("exploredCount", { count: attractions.length })}
        </span>
      </div>
      <SocialExplorationMap
        attractions={attractions}
        ariaLabel={label}
        appearance="comparison"
      />
    </article>
  );
}

function PaginatedExploredAttractionList({
  title,
  attractions,
  t,
  headingId,
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(attractions.length / COMPARISON_LOCATIONS_PAGE_SIZE)
  );
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * COMPARISON_LOCATIONS_PAGE_SIZE;
  const visibleAttractions = attractions.slice(
    pageStart,
    pageStart + COMPARISON_LOCATIONS_PAGE_SIZE
  );

  function changePage(nextPage) {
    setPage(nextPage);
    document
      .getElementById(headingId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <ExploredAttractionList
        title={title}
        attractions={visibleAttractions}
        t={t}
        headingId={headingId}
      />
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={changePage}
        ariaLabel={title}
        getPageAriaLabel={(pageNumber) =>
          t("comparisonLocationsGoToPage", { page: pageNumber })
        }
        previousLabel={t("previous")}
        nextLabel={t("next")}
      />
    </div>
  );
}

function ExploredAttractionList({ title, attractions, t, headingId }) {
  return (
    <section className="mt-6">
      <h3 id={headingId} className="text-base font-bold text-attraction-ink">
        {title}
      </h3>
      {attractions.length === 0 ? (
        <p className="mt-2 rounded-[10px] bg-attraction-surface-soft px-4 py-3 text-sm text-attraction-muted">
          {t("noAttractionsInGroup")}
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {attractions.map((attraction) => (
            <li key={attraction.id}>
              <Link
                href={`/attractions/${attraction.id}`}
                className="block min-h-11 rounded-[10px] border border-attraction-border bg-white px-4 py-3 transition hover:border-attraction-primary-muted hover:bg-attraction-primary-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
              >
                <span className="font-semibold text-attraction-ink">
                  {attraction.name}
                </span>
                {(attraction.locationArea || attraction.address) && (
                  <span className="mt-1 block text-xs text-attraction-muted">
                    {attraction.locationArea || attraction.address}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionSkeleton({ label }) {
  return (
    <div className="animate-pulse" aria-label={label}>
      <div className="h-5 w-48 rounded bg-gray-200" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="h-32 rounded-[14px] bg-gray-100" />
        <div className="h-32 rounded-[14px] bg-gray-100" />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <main className="min-h-screen bg-attraction-page-bg px-4 py-10">
      <div className="mx-auto max-w-[1044px] animate-pulse">
        <div className="h-11 w-40 rounded-full bg-gray-200" />
        <div className="mt-5 h-48 rounded-[18px] bg-white" />
        <div className="mt-6 h-12 rounded bg-white" />
        <div className="mt-6 h-72 rounded-[18px] bg-white" />
      </div>
    </main>
  );
}

function formatJoinedAt(value, lang = "en") {
  if (!value) return "";
  const full = formatLocaleDate(value, lang, "long");
  if (!full) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = {
    en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
    zh: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
    ms: ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"],
  };
  const m = (months[lang] || months.en)[d.getMonth()];
  const y = d.getFullYear();
  if (lang === "zh") return `${y}年${m}`;
  return `${m} ${y}`;
}

function formatReviewDate(value, lang = "en", t) {
  if (!value) return t ? t("dateUnavailable") : "Date unavailable";
  return formatLocaleDate(value, lang, "short") || (t ? t("dateUnavailable") : "");
}
