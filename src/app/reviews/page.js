"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import { useLanguage } from "@/presentation/contexts/LanguageContext";
import Image from "next/image";

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_PHOTOS = 3;
const EDIT_WINDOW_DAYS = 3;

export default function MyReviewsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, translateCategory } = useLanguage();
  const {
    reviews,
    isLoading,
    loadReviews,
    deleteReview,
    updateReview,
    refreshReviews,
    refreshAttractionReviews,
  } = useReviews();
  const [search, setSearch] = useState("");
  const [editingReview, setEditingReview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [editRating, setEditRating] = useState(0);
  const [editText, setEditText] = useState("");
  const [editErrors, setEditErrors] = useState({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editPhotos, setEditPhotos] = useState([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState([]);
  const [photosToDelete, setPhotosToDelete] = useState([]);
  const photoInputRef = useRef(null);
  const nextPhotoIdRef = useRef(0);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const canEditReview = (review) => {
    if (!review) return false;

    const referenceDate = review.lastEditedAt
      ? new Date(review.lastEditedAt)
      : new Date(review.createdAt);
    const now = new Date();
    const diffTime = now - referenceDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    return diffDays >= EDIT_WINDOW_DAYS;
  };

  const getNextEditDate = (review) => {
    if (!review) return null;
    const referenceDate = review.lastEditedAt
      ? new Date(review.lastEditedAt)
      : new Date(review.createdAt);
    const nextDate = new Date(referenceDate);
    nextDate.setDate(nextDate.getDate() + EDIT_WINDOW_DAYS);
    return nextDate;
  };

  const getDaysUntilNextEdit = (review) => {
    if (!review) return 0;
    const nextDate = getNextEditDate(review);
    const now = new Date();
    const diffTime = nextDate - now;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(diffDays));
  };

  const formatNextEditDate = (review) => {
    const nextDate = getNextEditDate(review);
    if (!nextDate) return "N/A";
    return nextDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/reviews");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadReviews();
    }
  }, [session, loadReviews]);

  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((preview) => {
        URL.revokeObjectURL(preview);
      });
    };
  }, [newPhotoPreviews]);

  useEffect(() => {
    const refreshIfNeeded = () => {
      if (localStorage.getItem("reviewDeleted") === "true") {
        localStorage.removeItem("reviewDeleted");
        console.log("Refreshing reviews page after delete...");
        refreshReviews();
      }
      if (localStorage.getItem("reviewAdded") === "true") {
        localStorage.removeItem("reviewAdded");
        console.log("Refreshing reviews page after add...");
        refreshReviews();
      }
    };

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        refreshIfNeeded();
      }
    });

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener("visibilitychange", refreshIfNeeded);
    };
  }, [refreshReviews]);

  const filtered = reviews.filter(
    (r) =>
      r.attractionId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.reviewText?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    if (!deleteTarget._id) {
      console.error("No review ID found:", deleteTarget);
      showToast(t("errorGeneric"), "error");
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);

    try {
      const data = await deleteReview(deleteTarget._id);
      console.log("Delete response:", data);

      if (data.success) {
        setDeleteTarget(null);
        await refreshReviews();
        if (deleteTarget.attractionId?._id || deleteTarget.attractionId) {
          const attractionId =
            deleteTarget.attractionId._id || deleteTarget.attractionId;
          await refreshAttractionReviews(attractionId);
        }
        localStorage.setItem("reviewDeleted", "true");
        showToast(t("profileUpdated"), "success");
      } else {
        showToast(data.message || t("errorGeneric"), "error");
        await refreshReviews();
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error("Error deleting review:", err);
      showToast(t("errorGeneric"), "error");
      await refreshReviews();
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (review) => {
    if (!canEditReview(review)) {
      const days = getDaysUntilNextEdit(review);
      const nextDate = formatNextEditDate(review);
      showToast(
        `${t("editReview")}: ${nextDate} (${days})`,
        "error"
      );
      return;
    }

    setEditingReview(review);
    setEditRating(review.rating || 0);
    setEditText(review.reviewText || "");
    setEditErrors({});
    setEditPhotos(review.photos || []);
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
    setPhotosToDelete([]);
  };

  const closeEditModal = () => {
    newPhotoPreviews.forEach((preview) => {
      URL.revokeObjectURL(preview);
    });
    setEditingReview(null);
    setEditRating(0);
    setEditText("");
    setEditErrors({});
    setIsSubmittingEdit(false);
    setEditPhotos([]);
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
    setPhotosToDelete([]);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handleEditRating = (value) => {
    setEditRating(value);
    setEditErrors((current) => ({ ...current, rating: "" }));
  };

  const handleEditTextChange = (event) => {
    setEditText(event.target.value);
    setEditErrors((current) => ({ ...current, reviewText: "" }));
  };

  const handlePhotoSelection = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setEditErrors((current) => ({ ...current, photos: "" }));

    if (files.length === 0) return;

    const totalPhotos = editPhotos.length + newPhotoFiles.length + files.length;
    if (totalPhotos > MAX_REVIEW_PHOTOS) {
      setEditErrors((current) => ({
        ...current,
        photos: t("uploadHint"),
      }));
      return;
    }

    const invalidType = files.some(
      (file) => !ALLOWED_PHOTO_TYPES.includes(file.type)
    );
    if (invalidType) {
      setEditErrors((current) => ({
        ...current,
        photos: t("unsupportedFormat"),
      }));
      return;
    }

    const oversizedPhoto = files.some(
      (file) => file.size > MAX_PHOTO_SIZE_BYTES
    );
    if (oversizedPhoto) {
      setEditErrors((current) => ({
        ...current,
        photos: t("fileTooLarge"),
      }));
      return;
    }

    const previews = files.map((file) => URL.createObjectURL(file));
    setNewPhotoFiles((prev) => [...prev, ...files]);
    setNewPhotoPreviews((prev) => [...prev, ...previews]);
  };

  const handleRemoveExistingPhoto = (photoIndex) => {
    const photoToRemove = editPhotos[photoIndex];
    setEditPhotos((prev) => prev.filter((_, i) => i !== photoIndex));
    if (photoToRemove?.publicId) {
      setPhotosToDelete((prev) => [...prev, photoToRemove.publicId]);
    }
  };

  const handleRemoveNewPhoto = (index) => {
    URL.revokeObjectURL(newPhotoPreviews[index]);
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;

    if (!canEditReview(editingReview)) {
      const days = getDaysUntilNextEdit(editingReview);
      showToast(`${t("editReview")} (${days})`, "error");
      closeEditModal();
      return;
    }

    const nextErrors = {};
    if (editRating < 1 || editRating > 5) {
      nextErrors.rating = t("yourRating");
    }
    if (!editText.trim()) {
      nextErrors.reviewText = t("reviewPlaceholder");
    } else if (editText.trim().length > 1000) {
      nextErrors.reviewText = t("errorGeneric");
    }

    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const formData = new FormData();
      formData.append("rating", editRating);
      formData.append("reviewText", editText.trim());

      const keepPhotoUrls = editPhotos.map((p) => p.url || p);
      formData.append("keepPhotos", JSON.stringify(keepPhotoUrls));
      formData.append("deletePhotos", JSON.stringify(photosToDelete));

      newPhotoFiles.forEach((file) => {
        formData.append("newPhotos", file);
      });

      const response = await fetch(`/api/reviews/${editingReview._id}`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        await refreshReviews();
        showToast(t("profileUpdated"), "success");
        closeEditModal();
      } else {
        showToast(data.message || t("errorGeneric"), "error");
      }
    } catch (err) {
      console.error("Error updating review:", err);
      showToast(t("errorGeneric"), "error");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[#65748A]">{t("loading")}</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalPhotos = editPhotos.length + newPhotoFiles.length;

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

      {editingReview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[18px] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[#10213B]">
                {t("editReview")}
              </h2>
              <button
                onClick={closeEditModal}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#65748A] transition-colors hover:bg-[#F7F9FB] hover:text-[#10213B]"
              >
                <svg
                  className="h-6 w-6"
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

            <div className="mb-5 rounded-lg border border-[#D8E1E7] bg-[#F7F9FB] p-3">
              <p className="text-sm text-[#65748A]">
                <span className="font-medium text-[#10213B]">
                  {t("editReview")}
                </span>
                {editingReview && (
                  <span className="mt-1 block text-xs">
                    {formatNextEditDate(editingReview)}
                  </span>
                )}
              </p>
            </div>

            <div className="mb-5 border-b border-[#D8E1E7] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#CDF5E5] text-2xl">
                  {editingReview.attractionId?.photos &&
                  editingReview.attractionId.photos.length > 0 ? (
                    <Image
                      src={editingReview.attractionId.photos[0]}
                      alt={editingReview.attractionId.name || "Attraction"}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "📍"
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#10213B]">
                    {editingReview.attractionId?.name || "—"}
                  </h3>
                  <span className="rounded-full border border-[#A7D7C5] bg-[#E6F7F0] px-2 py-0.5 text-xs text-[#004638]">
                    {editingReview.attractionId?.category
                      ? translateCategory
                        ? translateCategory(editingReview.attractionId.category)
                        : editingReview.attractionId.category
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-[#10213B]">
                {t("yourRating")} <span className="text-[#C2413B]">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {STAR_OPTIONS.map((value) => {
                  const isSelected = editRating === value;
                  const isFilled = value <= editRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleEditRating(value)}
                      className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[10px] border-2 transition-all duration-200 hover:scale-105 ${
                        isSelected
                          ? "border-[#006C56] bg-[#E6F7F0] ring-2 ring-[#006C56] ring-offset-1"
                          : "border-[#D8E1E7] bg-white hover:border-[#006C56] hover:bg-[#F7F9FB]"
                      }`}
                    >
                      <span
                        className={`text-2xl ${
                          isFilled ? "text-[#FFAB00]" : "text-[#D8E1E7]"
                        }`}
                      >
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-sm text-[#65748A]">
                {editRating
                  ? `${editRating} / 5 ${t("stars")}`
                  : t("yourRating")}
              </p>
              {editErrors.rating && (
                <p className="mt-1 text-sm text-[#C2413B]">{editErrors.rating}</p>
              )}
            </div>

            <div className="mb-5">
              <label
                htmlFor="edit-review-text"
                className="mb-2 block text-sm font-semibold text-[#10213B]"
              >
                {t("myReviews")} <span className="text-[#C2413B]">*</span>
              </label>
              <textarea
                id="edit-review-text"
                value={editText}
                onChange={handleEditTextChange}
                rows={4}
                maxLength={1000}
                placeholder={t("reviewPlaceholder")}
                className={`w-full resize-none rounded-[10px] border-2 px-4 py-3 outline-none transition-colors duration-200 ${
                  editErrors.reviewText
                    ? "border-[#C2413B] focus:border-[#C2413B]"
                    : "border-[#D8E1E7] focus:border-[#006C56]"
                }`}
              />
              <div className="mt-1 flex justify-between text-sm text-[#65748A]">
                <span>{editText.length} / 1000</span>
                {editErrors.reviewText && (
                  <span className="text-[#C2413B]">{editErrors.reviewText}</span>
                )}
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-[#10213B]">
                  {t("photos")}{" "}
                  <span className="font-normal text-[#65748A]">
                    (max {MAX_REVIEW_PHOTOS})
                  </span>
                </label>
                <span className="text-sm text-[#65748A]">
                  {totalPhotos} / {MAX_REVIEW_PHOTOS}
                </span>
              </div>

              {editPhotos.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-2">
                    {editPhotos.map((photo, index) => (
                      <div key={`existing-${index}`} className="group relative">
                        <div className="h-20 w-20 overflow-hidden rounded-lg border-2 border-[#D8E1E7] bg-[#CDF5E5]">
                          <Image
                            src={photo.url || photo}
                            alt={`Photo ${index + 1}`}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingPhoto(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#C2413B] text-white shadow-md transition-colors hover:bg-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {newPhotoPreviews.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-2">
                    {newPhotoPreviews.map((preview, index) => (
                      <div key={`new-${index}`} className="group relative">
                        <div className="h-20 w-20 overflow-hidden rounded-lg border-2 border-[#006C56] bg-[#CDF5E5]">
                          <Image
                            src={preview}
                            alt={`New photo ${index + 1}`}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewPhoto(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#C2413B] text-white shadow-md hover:bg-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalPhotos < MAX_REVIEW_PHOTOS && (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelection}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-[#D8E1E7] py-3 text-[#65748A] transition-colors hover:border-[#006C56] hover:bg-[#F7F9FB] hover:text-[#006C56]"
                  >
                    {t("uploadPhoto")}
                  </button>
                </>
              )}

              {editErrors.photos && (
                <p className="mt-2 text-sm text-[#C2413B]">{editErrors.photos}</p>
              )}
            </div>

            <div className="flex gap-3 border-t border-[#D8E1E7] pt-4">
              <button
                onClick={closeEditModal}
                className="flex-1 rounded-lg border-2 border-[#D8E1E7] px-5 py-2.5 font-semibold text-[#65748A] transition-colors hover:bg-[#F7F9FB]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSubmittingEdit}
                className="flex-1 rounded-lg bg-[#006C56] px-5 py-2.5 font-semibold text-white transition-colors hover:bg-[#005544] disabled:opacity-50"
              >
                {isSubmittingEdit ? t("saving") : t("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div className="w-full max-w-md rounded-[18px] bg-white p-6">
            <h3 className="text-center text-xl font-bold text-[#10213B]">
              {t("confirmDeleteReview")}
            </h3>
            <p className="mt-2 text-center text-[#65748A]">
              &quot;
              <span className="font-semibold text-[#10213B]">
                {deleteTarget.attractionId?.name || "—"}
              </span>
              &quot;
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-[#BBC8D0] px-5 py-2.5 font-semibold text-[#004638] transition-colors hover:bg-[#F1F6F4]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleDelete}
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
            ← {t("back")}
          </button>
          <h1 className="text-3xl font-bold md:text-4xl">{t("myReviews")}</h1>
          <p className="mt-2 text-white/80">
            {filtered.length === 0
              ? t("noReviewsYet")
              : t("youHaveReviews", { count: filtered.length })}
          </p>
          <div className="mt-4 flex max-w-md items-center overflow-hidden rounded-lg bg-white">
            <div className="pl-4 text-[#98A2B3]">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent px-3 py-2 text-[#10213B] outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-8">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold text-[#10213B]">
              {t("noReviewsYet")}
            </h3>
            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-lg bg-[#FFAB00] px-6 py-2 font-semibold text-[#142033] transition-colors hover:bg-[#E89B00]"
            >
              {t("browseAttractions")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h3 className="text-xl font-semibold text-[#10213B]">
              {t("noAttractionsFound")}
            </h3>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((review) => {
              const isEditable = canEditReview(review);
              const daysUntilEdit = getDaysUntilNextEdit(review);
              const nextDate = formatNextEditDate(review);

              return (
                <div
                  key={review._id}
                  className="rounded-[18px] border border-[#D8E1E7] bg-white p-6 transition-shadow hover:shadow-lg md:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-[#10213B]">
                          {review.attractionId?.name || "—"}
                        </h3>
                        <span className="rounded-full border border-[#A7D7C5] bg-[#E6F7F0] px-3 py-1 text-sm font-medium text-[#004638]">
                          {review.attractionId?.category
                            ? translateCategory
                              ? translateCategory(review.attractionId.category)
                              : review.attractionId.category
                            : "—"}
                        </span>
                      </div>

                      <div className="mb-3 flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={
                                i < review.rating
                                  ? "text-2xl text-[#FFAB00]"
                                  : "text-2xl text-[#D8E1E7]"
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-base font-medium text-[#65748A]">
                          {new Date(review.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>

                      <p className="mb-4 text-lg leading-relaxed text-[#405066]">
                        {review.reviewText}
                      </p>

                      {review.photos && review.photos.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-4">
                          {review.photos.slice(0, 4).map((photo, index) => (
                            <div
                              key={index}
                              className="relative h-28 w-28 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-[#D8E1E7] bg-[#CDF5E5] shadow-sm transition-transform hover:scale-105"
                            >
                              <Image
                                src={photo.url || photo}
                                alt={`Review photo ${index + 1}`}
                                fill
                                sizes="(max-width: 768px) 100px, 112px"
                                className="object-cover"
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(review)}
                          disabled={!isEditable}
                          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors ${
                            isEditable
                              ? "border-[#D8E1E7] text-[#65748A] hover:border-[#006C56] hover:text-[#006C56]"
                              : "cursor-not-allowed border-[#E8E8E8] text-[#C0C0C0] opacity-50"
                          }`}
                          title={
                            isEditable
                              ? t("editReview")
                              : nextDate
                          }
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(review)}
                          disabled={isDeleting}
                          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#D8E1E7] text-[#65748A] transition-colors hover:border-[#C2413B] hover:text-[#C2413B] disabled:opacity-50"
                          title={t("deleteReview")}
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                      {isEditable ? (
                        <span className="text-xs font-medium text-[#16845B]">
                          {t("edit")}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[#C2413B]">
                          {daysUntilEdit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}