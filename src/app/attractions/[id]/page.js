"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ReviewForm from "@/presentation/components/reviews/ReviewForm";
import ReviewList from "@/presentation/components/reviews/ReviewList";
import StarRating from "@/presentation/components/StarRating";
import {
  BackArrowIcon,
  LocationPinIcon,
} from "@/presentation/components/AttractionIcons";
import AttractionPhotoGallery from "@/presentation/components/AttractionPhotoGallery";
import CommunityPhotoUpload from "@/presentation/components/CommunityPhotoUpload";
import CommunityDescriptionEdit from "@/presentation/components/CommunityDescriptionEdit";
import {
  addToFavourites,
  removeFromFavourites,
  checkFavouritesStatus,
} from "@/business/services/favouritesService";
import VerifiedVisitorPhotos from "@/presentation/components/VerifiedVisitorPhotos";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function AttractionDetailsPage() {
  const params = useParams();
  const attractionId = params.id;
  const { data: session } = useSession();
  const router = useRouter();
  const { t, translateCategory } = useLanguage();

  const [attraction, setAttraction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewRefreshVersion, setReviewRefreshVersion] = useState(0);
  const [isInFavourites, setIsInFavourites] = useState(false);
  const [isFavouriteLoading, setIsFavouriteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function loadAttractionDetails() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(
          `/api/attractions/${encodeURIComponent(attractionId)}`
        );

        if (response.status === 404) {
          throw new Error(t("notFound"));
        }

        if (!response.ok) {
          throw new Error(t("errorGeneric"));
        }

        const result = await response.json();
        setAttraction(result.data);
      } catch (err) {
        console.error("Failed to load attraction details:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    if (attractionId) {
      loadAttractionDetails();
    }
  }, [attractionId, t]);

  useEffect(() => {
    if (session && attractionId) {
      checkFavouritesStatus(attractionId)
        .then((res) => setIsInFavourites(res.inFavourites || false))
        .catch(() => {});
    }
  }, [session, attractionId]);

  const handleFavouritesToggle = async () => {
    if (!session) {
      router.push("/login");
      return;
    }

    setIsFavouriteLoading(true);
    try {
      if (isInFavourites) {
        await removeFromFavourites(attractionId);
        setIsInFavourites(false);
        showToast(t("removeFromFavourites"), "info");
      } else {
        await addToFavourites(attractionId);
        setIsInFavourites(true);
        showToast(t("addToFavourites"), "success");
      }
    } catch (err) {
      console.error("Error toggling favourites:", err);
      const errorMsg =
        err.response?.data?.message || t("errorGeneric");
      showToast(errorMsg, "error");
    } finally {
      setIsFavouriteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <p className="text-center text-attraction-muted">{t("loading")}</p>
      </main>
    );
  }

  if (error || !attraction) {
    return (
      <main className="min-h-screen bg-attraction-page-bg px-6 py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-attraction-border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-attraction-ink">
            {t("errorGeneric")}
          </h1>
          <p className="mt-3 text-attraction-error">
            {error || t("notFound")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-[10px] bg-attraction-primary px-5 py-3 font-semibold text-white transition hover:bg-attraction-primary-hover"
          >
            {t("browseAttractions")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-attraction-page-bg">
      <div className="mx-auto max-w-[1120px] px-4 py-8 pb-16 md:px-6 lg:px-[38px]">
        <Link
          href="/"
          className="mb-7 inline-flex h-10 items-center gap-2 rounded-full border border-attraction-border bg-white py-0 pl-3 pr-4 text-sm font-semibold text-attraction-body transition hover:border-attraction-border-strong hover:bg-attraction-surface-soft"
        >
          <BackArrowIcon />
          {t("back")}
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-5">
              <span className="mb-3 inline-block rounded-full bg-attraction-primary-soft px-3 py-1 text-[13px] font-semibold text-attraction-primary">
                {attraction.category
                  ? translateCategory
                    ? translateCategory(attraction.category)
                    : attraction.category
                  : "—"}
              </span>

              {attraction.submittedBy && (
                <span className="mb-3 ml-2 inline-block rounded-full bg-sky-100 px-3 py-1 text-[13px] font-semibold text-sky-700">
                  {t("communitySubmitted")}
                </span>
              )}

              <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-attraction-ink md:text-3xl lg:text-4xl">
                {attraction.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <StarRating
                  rating={
                    attraction.combinedRating ?? attraction.rating ?? 0
                  }
                  size={16}
                />
                <p className="text-[13px] text-attraction-muted">
                  {(attraction.chatlasReviewCount ?? 0).toLocaleString()}{" "}
                  Chatlas,{" "}
                  {(
                    attraction.googleReviewCount ??
                    attraction.totalReviews ??
                    0
                  ).toLocaleString()}{" "}
                  Google Maps
                </p>
              </div>
            </div>

            <AttractionPhotoGallery attraction={attraction} />

            <CommunityPhotoUpload
              attractionId={attractionId}
              onPhotoAdded={(updatedAttraction) =>
                setAttraction((current) => ({
                  ...current,
                  photos: updatedAttraction.photos,
                }))
              }
            />

            <CommunityDescriptionEdit
              attractionId={attractionId}
              description={attraction.description}
              descriptionSource={attraction.descriptionSource}
              descriptionLastEditedBy={attraction.descriptionLastEditedBy}
              onDescriptionUpdated={(updates) =>
                setAttraction((current) => ({ ...current, ...updates }))
              }
            />

            <section className="mt-8">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-attraction-ink">
                    {t("communityTitle")}
                  </h2>
                  <p className="mt-1 text-sm text-attraction-muted">
                    {t("latestReviews")}
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

            <VerifiedVisitorPhotos
              key={attractionId}
              attractionId={attractionId}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[18px] border border-attraction-border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-attraction-ink">
                  {t("details")}
                </h2>

                <button
                  onClick={handleFavouritesToggle}
                  disabled={isFavouriteLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-attraction-border bg-white shadow-sm transition-all duration-200 hover:scale-110 hover:shadow-md disabled:opacity-50"
                  title={
                    isInFavourites
                      ? t("removeFromFavourites")
                      : t("addToFavourites")
                  }
                >
                  <svg
                    className="h-5 w-5"
                    fill={isInFavourites ? "#FFAB00" : "none"}
                    stroke={isInFavourites ? "#FFAB00" : "#65748A"}
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <polygon
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    />
                  </svg>
                </button>
              </div>

              <InfoRow
                icon={<CategoryIcon />}
                label={t("category")}
                value={
                  attraction.category
                    ? translateCategory
                      ? translateCategory(attraction.category)
                      : attraction.category
                    : "—"
                }
              />
              <Divider />
              <InfoRow
                icon={<LocationPinIcon />}
                label={t("address")}
                value={attraction.address}
              />
              <Divider />
              <InfoRow
                icon={<StarIcon />}
                label={t("rating")}
                value={`${(
                  attraction.combinedRating ??
                  attraction.rating ??
                  0
                ).toFixed(1)} / 5`}
                subValue={`${(
                  attraction.chatlasReviewCount ?? 0
                ).toLocaleString()} Chatlas, ${(
                  attraction.googleReviewCount ??
                  attraction.totalReviews ??
                  0
                ).toLocaleString()} Google Maps`}
              />
            </div>

            <Link
              href={`/attractions/${attractionId}/location`}
              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-attraction-primary text-[15px] font-semibold text-white transition hover:bg-attraction-primary-hover"
            >
              <LocationPinIcon />
              {t("openInMaps")}
            </Link>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-lg px-6 py-3 shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-[#16845B] text-white"
              : toast.type === "error"
                ? "bg-[#C2413B] text-white"
                : "bg-[#2F6DA1] text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}

function Divider() {
  return <div className="my-3.5 border-t border-attraction-divider" />;
}

function InfoRow({ icon, label, value, subValue }) {
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
        {subValue && (
          <p className="text-xs leading-relaxed text-attraction-muted">
            {subValue}
          </p>
        )}
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