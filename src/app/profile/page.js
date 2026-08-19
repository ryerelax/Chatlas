"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { reviews, isLoading, loadReviews, refreshReviews } = useReviews();
  const { t } = useLanguage();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    placesVisited: 0,
    photosUploaded: 0,
    savedPlaces: 0,
    wishlistCount: 0,
    favouritesCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      async function fetchUserData() {
        try {
          const response = await fetch("/api/user");
          const result = await response.json();

          if (!cancelled && result.success) {
            setUserData(result.data);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }

      fetchUserData();
      loadReviews(true);
      fetchCollectionStats();
    }

    return () => {
      cancelled = true;
    };
  }, [status, router, loadReviews]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const refreshIfNeeded = () => {
      if (localStorage.getItem("reviewDeleted") === "true") {
        localStorage.removeItem("reviewDeleted");
        refreshReviews();
        fetchCollectionStats();
      }
      if (localStorage.getItem("reviewAdded") === "true") {
        localStorage.removeItem("reviewAdded");
        refreshReviews();
        fetchCollectionStats();
      }
      if (localStorage.getItem("photoDeleted") === "true") {
        localStorage.removeItem("photoDeleted");
        refreshReviews();
        fetchCollectionStats();
      }
      if (localStorage.getItem("profileUpdated") === "true") {
        localStorage.removeItem("profileUpdated");
        refreshReviews();
        fetchCollectionStats();
      }
    };

    window.addEventListener("focus", refreshIfNeeded);
    const onVisibilityChange = () => {
      if (!document.hidden) {
        refreshIfNeeded();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [status, refreshReviews]);

  const fetchCollectionStats = async () => {
    setStatsLoading(true);
    try {
      const [wishlistRes, favouritesRes] = await Promise.all([
        fetch("/api/collection/wishlist").catch(() => ({
          json: async () => ({ data: [] }),
        })),
        fetch("/api/collection/favourites").catch(() => ({
          json: async () => ({ data: [] }),
        })),
      ]);

      const wishlistData = await wishlistRes.json();
      const favouritesData = await favouritesRes.json();

      const wishlistItems = wishlistData?.data || [];
      const favouritesItems = favouritesData?.data || [];

      const wishlistIds = new Set(
        wishlistItems.map(
          (item) => item.attractionId?._id || item.attractionId
        )
      );
      const favouritesIds = new Set(
        favouritesItems.map(
          (item) => item.attractionId?._id || item.attractionId
        )
      );
      const allSavedIds = new Set([...wishlistIds, ...favouritesIds]);

      setStats((prev) => ({
        ...prev,
        savedPlaces: allSavedIds.size,
        wishlistCount: wishlistItems.length,
        favouritesCount: favouritesItems.length,
      }));
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  if (status === "loading" || loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FB]">
        <div className="text-[#006C56]">{t("loading")}</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const displayName =
    userData?.displayName ||
    session.user.displayName ||
    session.user.name ||
    "User";
  const email = userData?.email || session.user.email;
  const profilePicture =
    userData?.profilePicture || session.user.image || "/default-avatar.png";
  const bio = userData?.bio || session.user.bio || "";
  const location = userData?.location || session.user.location || "";
  const reviewsWritten = reviews.length;

  const photosCount = reviews.reduce((total, review) => {
    return total + (review.photos?.length || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-[#F7F9FB] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-lg bg-white p-8 shadow-md">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <img
              src={profilePicture}
              alt="Profile"
              className="h-24 w-24 rounded-full border-4 border-[#006C56] object-cover"
              onError={(e) => {
                e.target.src = "/default-avatar.png";
              }}
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#10213B]">
                {displayName}
              </h1>
              <p className="text-[#65748A]">{email}</p>
              {location && (
                <p className="text-sm text-[#65748A]">
                  {t("locationLabel")}: {location}
                </p>
              )}
              <p className="text-sm text-[#65748A]">
                {t("memberSince")}{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {bio && <p className="mt-2 text-[#405066]">{bio}</p>}
            </div>
            <Link
              href="/profile/edit"
              className="rounded-lg border border-[#006C56] px-6 py-2 text-[#006C56] transition hover:bg-[#006C56] hover:text-white"
            >
              {t("editProfile")}
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-[#006C56]">
              {statsLoading ? "..." : stats.placesVisited}
            </p>
            <p className="text-sm text-[#65748A]">{t("placesVisited")}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-[#006C56]">
              {statsLoading ? "..." : reviewsWritten}
            </p>
            <p className="text-sm text-[#65748A]">{t("reviewsWritten")}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-[#006C56]">
              {statsLoading ? "..." : photosCount}
            </p>
            <p className="text-sm text-[#65748A]">{t("photosUploaded")}</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-[#006C56]">
              {statsLoading ? "..." : stats.savedPlaces}
            </p>
            <p className="text-sm text-[#65748A]">{t("savedPlaces")}</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[#D8E1E7] bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <svg
              className="h-5 w-5 text-[#006C56]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h2 className="text-lg font-bold text-[#10213B]">
              {t("yourCollection")}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Link
              href="/wishlist"
              className="group relative rounded-xl border-2 border-[#FEF2F2] bg-gradient-to-br from-[#FEF2F2] to-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#C2413B] hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C2413B] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-7 w-7"
                  fill="white"
                  stroke="white"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base font-bold text-[#10213B]">
                {t("wishlist")}
              </p>
              <p className="text-sm text-[#65748A]">
                {statsLoading
                  ? "..."
                  : `${stats.wishlistCount || 0} ${t("itemsSaved")}`}
              </p>
              <div className="mt-3 text-sm font-medium text-[#C2413B] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t("view")}
              </div>
            </Link>

            <Link
              href="/favourites"
              className="group relative rounded-xl border-2 border-[#FFF3D6] bg-gradient-to-br from-[#FFF3D6] to-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#FFAB00] hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFAB00] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base font-bold text-[#10213B]">
                {t("favourites")}
              </p>
              <p className="text-sm text-[#65748A]">
                {statsLoading
                  ? "..."
                  : `${stats.favouritesCount || 0} ${t("itemsSaved")}`}
              </p>
              <div className="mt-3 text-sm font-medium text-[#FFAB00] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t("view")}
              </div>
            </Link>

            <Link
              href="/reviews"
              className="group relative rounded-xl border-2 border-[#EAF3FA] bg-gradient-to-br from-[#EAF3FA] to-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#2F6DA1] hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2F6DA1] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base font-bold text-[#10213B]">
                {t("myReviews")}
              </p>
              <p className="text-sm text-[#65748A]">
                {statsLoading
                  ? "..."
                  : `${reviewsWritten || 0} ${t("reviewsWrittenCount")}`}
              </p>
              <div className="mt-3 text-sm font-medium text-[#2F6DA1] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t("view")}
              </div>
            </Link>

            <Link
              href="/photos"
              className="group relative rounded-xl border-2 border-[#F3F0FF] bg-gradient-to-br from-[#F3F0FF] to-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#7C3AED] hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base font-bold text-[#10213B]">
                {t("myPhotos")}
              </p>
              <p className="text-sm text-[#65748A]">
                {statsLoading
                  ? "..."
                  : `${photosCount || 0} ${t("photosUploadedCount")}`}
              </p>
              <div className="mt-3 text-sm font-medium text-[#7C3AED] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t("view")}
              </div>
            </Link>

            <Link
              href="/travel-history"
              className="group relative rounded-xl border-2 border-[#E8F7EF] bg-gradient-to-br from-[#E8F7EF] to-white p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#16845B] hover:shadow-lg"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16845B] text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base font-bold text-[#10213B]">
                {t("travelHistory")}
              </p>
              <p className="text-sm text-[#65748A]">0 attractions</p>
              <div className="mt-3 text-sm font-medium text-[#16845B] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t("view")}
              </div>
            </Link>
          </div>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-md">
          <h2 className="mb-4 text-xl font-bold text-[#10213B]">
            {t("recentReviews")}
          </h2>
          {statsLoading ? (
            <p className="text-[#65748A]">{t("loading")}</p>
          ) : reviewsWritten === 0 ? (
            <p className="text-[#65748A]">{t("noReviewsYet")}</p>
          ) : (
            <p className="text-[#65748A]">
              {t("youHaveReviews", { count: reviewsWritten })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}