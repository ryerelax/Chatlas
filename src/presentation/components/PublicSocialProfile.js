"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ProfileAvatar from "@/presentation/components/ProfileAvatar";
import SocialExplorationMap from "@/presentation/components/SocialExplorationMap";
import SocialProfileStatus from "@/presentation/components/SocialProfileStatus";
import StarRating from "@/presentation/components/StarRating";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "reviews", label: "Reviews" },
  { id: "exploration", label: "Exploration map" },
  { id: "compare", label: "Compare" },
];

export default function PublicSocialProfile() {
  const { id } = useParams();
  const { status } = useSession();
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load the public profile.");
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
  }, [id]);

  useEffect(() => {
    if (activeTab === "overview") return;
    if ((activeTab === "exploration" || activeTab === "compare") && status !== "authenticated") {
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
            message: result.message || "This section is currently unavailable.",
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
            message: "This section is currently unavailable.",
            code: "",
          });
        }
      }
    }

    loadSection();
    return () => controller.abort();
  }, [activeTab, id, status]);

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
            title="User profile not found"
            message={profileError || "This public profile does not exist."}
            actionHref="/profiles"
            actionLabel="Browse traveller profiles"
            tone="error"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <div className="mx-auto max-w-[1120px] px-4 py-8 pb-16 md:px-6 lg:px-[38px]">
        <Link
          href="/profiles"
          className="inline-flex min-h-11 items-center rounded-full border border-attraction-border bg-white px-4 text-sm font-semibold text-attraction-body transition hover:bg-attraction-surface-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
        >
          ← Back to travellers
        </Link>

        <section className="mt-5 rounded-[18px] border border-attraction-border bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileAvatar
              name={profile.displayName}
              src={profile.profilePicture}
              size="large"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-attraction-primary">Public traveller profile</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-attraction-ink">
                {profile.displayName}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-attraction-muted">
                <span>{profile.location || "Location not shared"}</span>
                <span>Member since {formatJoinedAt(profile.joinedAt)}</span>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-attraction-body">
                {profile.bio || "This traveller has not added a public bio yet."}
              </p>
            </div>
          </div>
        </section>

        <nav
          className="mt-6 overflow-x-auto border-b border-attraction-divider"
          aria-label="Public profile sections"
        >
          <div className="flex min-w-max gap-1">
            {TABS.map((tab) => (
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
          {activeTab === "overview" && <OverviewSection profile={profile} />}
          {activeTab === "reviews" && <ReviewsSection state={sectionState} />}
          {activeTab === "exploration" && (
            <ExplorationSection authStatus={status} state={sectionState} />
          )}
          {activeTab === "compare" && (
            <ComparisonSection
              authStatus={status}
              profile={profile}
              state={sectionState}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function OverviewSection({ profile }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-attraction-primary">Travel activity</p>
          <h2 className="mt-1 text-xl font-bold text-attraction-ink">Public activity summary</h2>
        </div>
        <span className="rounded-full bg-attraction-surface-soft px-3 py-1 text-xs font-semibold text-attraction-muted">
          See activity tabs
        </span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Reviews written" value={profile.activitySummary.reviewsWritten} />
        <SummaryCard label="Attractions visited" value={profile.activitySummary.visitedAttractions} />
        <SummaryCard label="Exploration progress" value={profile.activitySummary.explorationProgress} suffix="%" />
      </div>
      <p className="mt-5 rounded-[10px] bg-[#EAF3FA] px-4 py-3 text-sm leading-relaxed text-attraction-body">
        Open the Reviews and Exploration map tabs to view this traveller&apos;s published activity. A combined overview summary is still being prepared.
      </p>
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

function ReviewsSection({ state }) {
  if (state.status === "loading") return <SectionSkeleton label="Loading reviews" />;
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="i"
        title={state.code === "REVIEWS_UNAVAILABLE" ? "Reviews are not available yet" : "Unable to load reviews"}
        message={state.message}
        tone={state.code === "REVIEWS_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  const reviews = Array.isArray(state.data) ? state.data : [];
  if (reviews.length === 0) {
    return (
      <SocialProfileStatus
        icon="☆"
        title="No reviews available"
        message="This traveller has not published any reviews yet."
      />
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-attraction-ink">Public reviews</h2>
      <div className="mt-3 divide-y divide-attraction-divider">
        {reviews.map((review) => (
          <article key={review.id} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StarRating rating={Number(review.rating) || 0} />
              <time className="text-xs text-attraction-muted">
                {formatReviewDate(review.createdAt)}
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
                  <div key={photo} className="relative aspect-[4/3] overflow-hidden rounded-[10px]">
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
    </div>
  );
}

function ExplorationSection({ authStatus, state }) {
  if (authStatus === "loading") return <SectionSkeleton label="Checking access" />;
  if (authStatus !== "authenticated") {
    return (
      <SocialProfileStatus
        icon="⌖"
        title="Log in to view exploration maps"
        message="Public exploration maps are available to registered Chatlas users, as required by the Social Profile specification."
        actionHref="/login"
        actionLabel="Log in with Google"
        tone="info"
      />
    );
  }
  if (state.status === "loading") return <SectionSkeleton label="Loading exploration map" />;
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="⌖"
        title={state.code === "EXPLORATION_UNAVAILABLE" ? "Exploration map is not available yet" : "Exploration map is currently unavailable"}
        message={state.message}
        tone={state.code === "EXPLORATION_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  const attractions = state.data?.visitedAttractions || [];
  if (attractions.length === 0) {
    return (
      <div>
        <div className="mb-5 flex justify-end">
          <SummaryCard
            label="Exploration progress"
            value={state.data?.progressPercentage ?? 0}
            suffix="%"
          />
        </div>
        <SocialProfileStatus
          icon="⌖"
          title="No visited attractions available"
          message="This traveller has not reviewed any supported attractions yet."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-attraction-ink">Exploration map</h2>
          <p className="mt-1 text-sm text-attraction-muted">
            {attractions.length} visited attraction{attractions.length === 1 ? "" : "s"}
          </p>
        </div>
        <SummaryCard label="Exploration progress" value={state.data.progressPercentage} suffix="%" />
      </div>
      <SocialExplorationMap attractions={attractions} />
      <VisitedAttractionList title="Visited locations" attractions={attractions} />
    </div>
  );
}

function ComparisonSection({ authStatus, profile, state }) {
  if (authStatus === "loading") return <SectionSkeleton label="Checking access" />;
  if (authStatus !== "authenticated") {
    return (
      <SocialProfileStatus
        icon="⇄"
        title="Log in to compare exploration"
        message={`Log in with Google to compare your exploration progress and visited attractions with ${profile.displayName}.`}
        actionHref="/login"
        actionLabel="Log in with Google"
        tone="info"
      />
    );
  }
  if (state.status === "loading") return <SectionSkeleton label="Comparing exploration" />;
  if (state.status === "error") {
    return (
      <SocialProfileStatus
        icon="⇄"
        title={state.code === "COMPARISON_UNAVAILABLE" ? "Comparison is not available yet" : "Unable to compare exploration"}
        message={state.message}
        tone={state.code === "COMPARISON_UNAVAILABLE" ? "info" : "error"}
      />
    );
  }

  const comparison = state.data;
  if (!comparison) return null;

  return (
    <div>
      <h2 className="text-xl font-bold text-attraction-ink">Exploration progress comparison</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <ProgressComparisonCard user={comparison.viewer} label="You" />
        <ProgressComparisonCard user={comparison.target} label={profile.displayName} />
      </div>
      <div className="mt-8 space-y-7">
        <VisitedAttractionList title="Visited by both travellers" attractions={comparison.common || []} />
        <VisitedAttractionList title="Only visited by you" attractions={comparison.viewerOnly || []} />
        <VisitedAttractionList title={`Only visited by ${profile.displayName}`} attractions={comparison.targetOnly || []} />
      </div>
    </div>
  );
}

function ProgressComparisonCard({ user, label }) {
  const progress = Math.min(100, Math.max(0, Number(user?.progressPercentage) || 0));
  return (
    <article className="rounded-[14px] bg-attraction-primary-soft p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-attraction-ink">{label}</h3>
        <span className="text-sm font-semibold text-attraction-primary-dark">{progress}%</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white" aria-label={`${label} exploration progress: ${progress}%`}>
        <div className="h-full rounded-full bg-attraction-primary" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-3 text-sm text-attraction-body">
        {user?.visitedCount || 0} attraction{user?.visitedCount === 1 ? "" : "s"} visited
      </p>
    </article>
  );
}

function VisitedAttractionList({ title, attractions }) {
  return (
    <section className="mt-6">
      <h3 className="text-base font-bold text-attraction-ink">{title}</h3>
      {attractions.length === 0 ? (
        <p className="mt-2 rounded-[10px] bg-attraction-surface-soft px-4 py-3 text-sm text-attraction-muted">
          No attractions in this group.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {attractions.map((attraction) => (
            <li key={attraction.id}>
              <Link
                href={`/attractions/${attraction.id}`}
                className="block min-h-11 rounded-[10px] border border-attraction-border bg-white px-4 py-3 transition hover:border-attraction-primary-muted hover:bg-attraction-primary-soft focus:outline-none focus:ring-2 focus:ring-attraction-primary"
              >
                <span className="font-semibold text-attraction-ink">{attraction.name}</span>
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

function formatJoinedAt(value) {
  if (!value) return "date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatReviewDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
