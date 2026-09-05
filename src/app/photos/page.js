"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";

export default function MyPhotosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const {
    reviews,
    isLoading: reviewsLoading,
    loadReviews,
    refreshReviews,
  } = useReviews();
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingProfile, setIsSettingProfile] = useState(false);
  const [isInitialLoadPending, setIsInitialLoadPending] = useState(true);
  const [profilePictureOverride, setProfilePictureOverride] = useState(null);
  const hasRequestedReviewsRef = useRef(false);
  const currentProfilePicture =
    profilePictureOverride ?? session?.user?.profilePicture ?? "";
  const photos = useMemo(
    () => buildReviewPhotos(reviews, currentProfilePicture),
    [reviews, currentProfilePicture]
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/photos");
      return;
    }

    if (status === "authenticated" && !hasRequestedReviewsRef.current) {
      hasRequestedReviewsRef.current = true;
      loadReviews(true).finally(() => setIsInitialLoadPending(false));
    }
  }, [status, router, loadReviews]);

  useEffect(() => {
    const refreshIfNeeded = () => {
      let needsRefresh = false;
      if (localStorage.getItem("reviewAdded") === "true") {
        localStorage.removeItem("reviewAdded");
        needsRefresh = true;
      }
      if (localStorage.getItem("reviewDeleted") === "true") {
        localStorage.removeItem("reviewDeleted");
        needsRefresh = true;
      }
      if (localStorage.getItem("photoDeleted") === "true") {
        localStorage.removeItem("photoDeleted");
        needsRefresh = true;
      }
      if (localStorage.getItem("profileUpdated") === "true") {
        localStorage.removeItem("profileUpdated");
        needsRefresh = true;
      }

      if (needsRefresh) {
        refreshReviews();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshIfNeeded();
      }
    };

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshReviews]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSetProfile = async (photoId) => {
    setIsSettingProfile(true);

    try {
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) {
        showToast(t("errorGeneric"), "error");
        return;
      }

      const response = await fetch("/api/user/profile-picture", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photoUrl: photo.url,
          publicId: photo.publicId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setProfilePictureOverride(photo.url);
        localStorage.setItem("profileUpdated", "true");
        showToast(t("profileUpdated"), "success");

        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        showToast(data.message || t("errorGeneric"), "error");
      }
    } catch (error) {
      console.error("Error setting profile picture:", error);
      showToast(t("errorGeneric"), "error");
    } finally {
      setIsSettingProfile(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.reviewId) {
        const response = await fetch(
          `/api/reviews/${deleteTarget.reviewId}/photos`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ publicId: deleteTarget.publicId }),
          }
        );

        const data = await response.json();

        if (!data.success) {
          showToast(data.message || t("errorGeneric"), "error");
          setIsDeleting(false);
          return;
        }
      }

      if (deleteTarget.isProfilePicture) {
        const resetResponse = await fetch("/api/user/profile-picture", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            photoUrl: "",
            publicId: "",
          }),
        });

        await resetResponse.json();
        setProfilePictureOverride("");
        localStorage.setItem("profileUpdated", "true");
      }

      setDeleteTarget(null);
      localStorage.setItem("photoDeleted", "true");
      showToast(t("profileUpdated"), "success");

      await refreshReviews();

      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (error) {
      console.error("Error deleting photo:", error);
      showToast(t("errorGeneric"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (status === "loading" || isInitialLoadPending || reviewsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[#65748A]">{t("loading")}</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const profilePic = photos.find((p) => p.isProfilePicture);

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 w-full max-w-md -translate-x-1/2 transform px-4">
          <div
            className={`animate-in slide-in-from-top-5 flex items-center gap-3 rounded-xl border px-5 py-4 shadow-lg transition-all duration-300 ${
              toast.type === "success"
                ? "border-[#16845B] bg-[#E8F7EF] text-[#004638]"
                : "border-[#C2413B] bg-[#FDECEC] text-[#7A1A1A]"
            }`}
          >
            {toast.type === "success" ? (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#16845B]/20">
                <svg
                  className="h-5 w-5 text-[#16845B]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#C2413B]/20">
                <svg
                  className="h-5 w-5 text-[#C2413B]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            )}
            <span className="flex-1 text-base font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 text-[#65748A] transition-colors hover:text-[#10213B]"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full max-w-md rounded-[18px] bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-200 bg-red-50">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-center text-xl font-bold text-[#10213B]">
              {t("delete")}?
            </h3>
            <p className="mt-2 text-center text-[#65748A]">
              {t("confirmDeleteReview")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-[#BBC8D0] px-5 py-2.5 font-semibold text-[#004638] transition-colors hover:bg-[#F1F6F4]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDeletePhoto}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-[#C2413B] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? t("loading") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#006C56] px-4 py-12 text-white">
        <div className="mx-auto max-w-[1200px]">
          <button
            onClick={() => router.push("/profile")}
            className="mb-4 flex items-center gap-2 text-white/80 transition-colors hover:text-white"
          >
            ← {t("backToProfile")}
          </button>
          <h1 className="text-3xl font-bold md:text-4xl">
            {t("myPhotosTitle")}
          </h1>
          <p className="mt-2 text-white/80">
            {photos.length === 0
              ? t("emptyPhotos")
              : t("photosShowing", { count: photos.length })}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-8">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="mb-4 h-16 w-16 text-[#98A2B3]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">
              {t("emptyPhotos")}
            </h3>
            <p className="mt-2 text-[#65748A]">{t("noPhotosYet")}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-lg bg-[#FFAB00] px-6 py-2 font-semibold text-[#142033] transition-colors hover:bg-[#E89B00]"
            >
              {t("browseAttractions")}
            </button>
          </div>
        ) : (
          <>
            {profilePic && (
              <div className="mb-6 flex items-center gap-4 rounded-[14px] border border-[#D8E1E7] bg-white p-4">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border-2 border-[#006C56] bg-[#CDF5E5]">
                  {profilePic.url ? (
                    <Image
                      src={profilePic.url}
                      alt="Profile"
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[#006C56]/50">
                      —
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[#10213B]">
                    {t("currentProfilePicture")}
                  </p>
                  <p className="text-sm text-[#65748A]">
                    {profilePic.attractionName} / {profilePic.uploadedAt}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#CDF5E5]"
                  onClick={() => setLightboxPhoto(photo)}
                >
                  {photo.url ? (
                    <Image
                      src={photo.url}
                      alt={photo.attractionName}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#006C56]/30">
                      {t("noPhotosYet")}
                    </div>
                  )}

                  {photo.isProfilePicture && (
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-[#FFAB00] px-2 py-0.5 text-xs font-medium text-[#142033]">
                      {t("myProfile")}
                    </div>
                  )}

                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setLightboxPhoto(photo)}
                      className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-[#10213B] transition-colors hover:bg-white"
                    >
                      {t("view")}
                    </button>
                    {!photo.isProfilePicture && (
                      <button
                        onClick={() => handleSetProfile(photo.id)}
                        disabled={isSettingProfile}
                        className="rounded-md bg-[#FFAB00] px-3 py-1.5 text-xs font-medium text-[#142033] transition-colors hover:bg-[#E89B00] disabled:opacity-50"
                      >
                        {isSettingProfile
                          ? t("settingProfile")
                          : t("setAsProfile")}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(photo)}
                      disabled={isDeleting}
                      className="rounded-md bg-[#C2413B] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {t("delete")}
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-white">
                      {photo.attractionName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-[14px]"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxPhoto.url ? (
              <Image
                src={lightboxPhoto.url}
                alt={lightboxPhoto.attractionName}
                width={1200}
                height={800}
                className="max-h-[80vh] w-full object-contain"
              />
            ) : (
              <div className="flex h-96 w-full items-center justify-center bg-[#CDF5E5] text-[#006C56]/50">
                {t("noPhotosYet")}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-5 py-4">
              <p className="font-semibold text-white">
                {lightboxPhoto.attractionName}
              </p>
              <p className="text-sm text-white/70">{lightboxPhoto.uploadedAt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildReviewPhotos(reviews, currentProfilePicture) {
  const photoList = [];
  const seenUrls = new Set();

  reviews.forEach((review) => {
    if (!Array.isArray(review.photos)) {
      return;
    }

    review.photos.forEach((photo, index) => {
      if (
        !photo ||
        typeof photo.url !== "string" ||
        !photo.url ||
        typeof photo.publicId !== "string" ||
        !photo.publicId ||
        seenUrls.has(photo.url)
      ) {
        return;
      }

      photoList.push({
        id: `${review._id}-${index}`,
        reviewId: review._id,
        url: photo.url,
        publicId: photo.publicId,
        attractionName: review.attractionId?.name || "Unknown attraction",
        attractionId: review.attractionId?._id || review.attractionId,
        uploadedAt: new Date(review.createdAt).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        isProfilePicture: photo.url === currentProfilePicture,
      });
      seenUrls.add(photo.url);
    });
  });

  return photoList;
}
