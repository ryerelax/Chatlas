"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";
import Image from "next/image";

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_PHOTOS = 3;

export default function MyReviewsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { reviews, isLoading, loadReviews, deleteReview, updateReview, refreshReviews, refreshAttractionReviews } = useReviews();
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

  // Refresh when page comes into focus
  useEffect(() => {
    const refreshIfNeeded = () => {
      if (localStorage.getItem('reviewDeleted') === 'true') {
        localStorage.removeItem('reviewDeleted');
        console.log("Refreshing reviews page after delete...");
        refreshReviews();
      }
      if (localStorage.getItem('reviewAdded') === 'true') {
        localStorage.removeItem('reviewAdded');
        console.log("Refreshing reviews page after add...");
        refreshReviews();
      }
    };

    window.addEventListener("focus", refreshIfNeeded);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        refreshIfNeeded();
      }
    });

    return () => {
      window.removeEventListener("focus", refreshIfNeeded);
      document.removeEventListener('visibilitychange', refreshIfNeeded);
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
      showToast("Error: Review ID not found", "error");
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
          const attractionId = deleteTarget.attractionId._id || deleteTarget.attractionId;
          await refreshAttractionReviews(attractionId);
        }
        localStorage.setItem('reviewDeleted', 'true');
        showToast("Review deleted successfully!", "success");
      } else {
        showToast(data.message || "Failed to delete review", "error");
        await refreshReviews();
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error("Error deleting review:", err);
      showToast("Unable to delete review. Please try again.", "error");
      await refreshReviews();
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (review) => {
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
        photos: `Maximum ${MAX_REVIEW_PHOTOS} photos allowed.`,
      }));
      return;
    }

    const invalidType = files.some((file) => !ALLOWED_PHOTO_TYPES.includes(file.type));
    if (invalidType) {
      setEditErrors((current) => ({
        ...current,
        photos: "Photos must be JPG, PNG, or WebP images.",
      }));
      return;
    }

    const oversizedPhoto = files.some((file) => file.size > MAX_PHOTO_SIZE_BYTES);
    if (oversizedPhoto) {
      setEditErrors((current) => ({
        ...current,
        photos: "Each photo must be 5 MB or smaller.",
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

    const nextErrors = {};
    if (editRating < 1 || editRating > 5) {
      nextErrors.rating = "Please select a rating from 1 to 5 stars.";
    }
    if (!editText.trim()) {
      nextErrors.reviewText = "Please enter your review.";
    } else if (editText.trim().length > 1000) {
      nextErrors.reviewText = "Keep your review to 1,000 characters or fewer.";
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
        showToast("Review updated successfully!", "success");
        closeEditModal();
      } else {
        showToast(data.message || "Failed to update review", "error");
      }
    } catch (err) {
      console.error("Error updating review:", err);
      showToast("Unable to update review. Please try again.", "error");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your reviews...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const totalPhotos = editPhotos.length + newPhotoFiles.length;

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border transition-all duration-300 animate-in slide-in-from-top-5 ${
            toast.type === "success" 
              ? "bg-[#E8F7EF] border-[#16845B] text-[#004638]" 
              : "bg-[#FDECEC] border-[#C2413B] text-[#7A1A1A]"
          }`}>
            {toast.type === "success" ? (
              <div className="w-8 h-8 rounded-full bg-[#16845B]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#16845B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#C2413B]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#C2413B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <span className="text-base font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-[#65748A] hover:text-[#10213B] transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full max-w-lg rounded-[18px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#10213B]">Edit Review</h2>
              <button
                onClick={closeEditModal}
                className="w-10 h-10 flex items-center justify-center text-[#65748A] hover:text-[#10213B] rounded-full hover:bg-[#F7F9FB] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Attraction Info */}
            <div className="mb-5 pb-4 border-b border-[#D8E1E7]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#CDF5E5] flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                  {editingReview.attractionId?.photos && editingReview.attractionId.photos.length > 0 ? (
                    <Image
                      src={editingReview.attractionId.photos[0]}
                      alt={editingReview.attractionId.name || "Attraction"}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    "📍"
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#10213B]">
                    {editingReview.attractionId?.name || "Unknown attraction"}
                  </h3>
                  <span className="px-2 py-0.5 bg-[#E6F7F0] text-[#004638] text-xs rounded-full border border-[#A7D7C5]">
                    {editingReview.attractionId?.category || "Uncategorized"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rating */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#10213B] mb-2">
                Rating <span className="text-[#C2413B]">*</span>
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
                      <span className={`text-2xl ${isFilled ? "text-[#FFAB00]" : "text-[#D8E1E7]"}`}>
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-sm text-[#65748A]">
                {editRating ? `${editRating} out of 5 stars selected` : "No rating selected"}
              </p>
              {editErrors.rating && (
                <p className="mt-1 text-sm text-[#C2413B]">{editErrors.rating}</p>
              )}
            </div>

            {/* Review Text */}
            <div className="mb-5">
              <label htmlFor="edit-review-text" className="block text-sm font-semibold text-[#10213B] mb-2">
                Your review <span className="text-[#C2413B]">*</span>
              </label>
              <textarea
                id="edit-review-text"
                value={editText}
                onChange={handleEditTextChange}
                rows={4}
                maxLength={1000}
                placeholder="Share your experience..."
                className={`w-full px-4 py-3 rounded-[10px] border-2 outline-none transition-colors duration-200 resize-none ${
                  editErrors.reviewText
                    ? "border-[#C2413B] focus:border-[#C2413B]"
                    : "border-[#D8E1E7] focus:border-[#006C56]"
                }`}
              />
              <div className="mt-1 flex justify-between text-sm text-[#65748A]">
                <span>{editText.length} / 1000 characters</span>
                {editErrors.reviewText && (
                  <span className="text-[#C2413B]">{editErrors.reviewText}</span>
                )}
              </div>
            </div>

            {/* Photos - Edit */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[#10213B]">
                  Photos <span className="font-normal text-[#65748A]">(optional, max {MAX_REVIEW_PHOTOS})</span>
                </label>
                <span className="text-sm text-[#65748A]">{totalPhotos} / {MAX_REVIEW_PHOTOS}</span>
              </div>

              {/* Existing Photos */}
              {editPhotos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#65748A] mb-2">Current photos:</p>
                  <div className="flex gap-2 flex-wrap">
                    {editPhotos.map((photo, index) => (
                      <div key={`existing-${index}`} className="relative group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-[#D8E1E7] bg-[#CDF5E5]">
                          <Image
                            src={photo.url || photo}
                            alt={`Photo ${index + 1}`}
                            width={80}
                            height={80}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExistingPhoto(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-[#C2413B] text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Photos */}
              {newPhotoPreviews.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[#65748A] mb-2">New photos to add:</p>
                  <div className="flex gap-2 flex-wrap">
                    {newPhotoPreviews.map((preview, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-[#006C56] bg-[#CDF5E5]">
                          <Image
                            src={preview}
                            alt={`New photo ${index + 1}`}
                            width={80}
                            height={80}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveNewPhoto(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-[#C2413B] text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Photo Button */}
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
                    className="w-full py-3 border-2 border-dashed border-[#D8E1E7] rounded-lg text-[#65748A] hover:border-[#006C56] hover:text-[#006C56] hover:bg-[#F7F9FB] transition-colors"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add photos
                    </span>
                  </button>
                </>
              )}

              {editErrors.photos && (
                <p className="mt-2 text-sm text-[#C2413B]">{editErrors.photos}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[#D8E1E7]">
              <button
                onClick={closeEditModal}
                className="flex-1 px-5 py-2.5 border-2 border-[#D8E1E7] text-[#65748A] font-semibold rounded-lg hover:bg-[#F7F9FB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSubmittingEdit}
                className="flex-1 px-5 py-2.5 bg-[#006C56] text-white font-semibold rounded-lg hover:bg-[#005544] transition-colors disabled:opacity-50"
              >
                {isSubmittingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full max-w-md rounded-[18px] p-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 border border-red-200">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#10213B] text-center">Delete this review?</h3>
            <p className="text-[#65748A] text-center mt-2">
              Are you sure you want to permanently delete your review of "<span className="font-semibold text-[#10213B]">{deleteTarget.attractionId?.name || "this attraction"}</span>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-5 py-2.5 border border-[#BBC8D0] text-[#004638] font-semibold rounded-lg hover:bg-[#F1F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-5 py-2.5 bg-[#C2413B] text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-[#006C56] text-white py-12 px-4">
        <div className="max-w-[1200px] mx-auto">
          <button
            onClick={() => router.push("/profile")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Profile
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Reviews</h1>
          <p className="text-white/80 mt-2">
            {filtered.length === 0
              ? "Start exploring and share your experiences!"
              : `Showing ${filtered.length} review${filtered.length !== 1 ? "s" : ""}`}
          </p>
          <div className="mt-4 flex items-center bg-white rounded-lg overflow-hidden max-w-md">
            <div className="pl-4 text-[#98A2B3]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search your reviews…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-[#10213B] outline-none bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No reviews yet</h3>
            <p className="text-[#65748A] mt-2">You haven't written any reviews yet.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-[#FFAB00] text-[#142033] font-semibold rounded-lg hover:bg-[#E89B00] transition-colors"
            >
              Explore Attractions
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No matches found</h3>
            <p className="text-[#65748A] mt-2">No reviews match your search.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((review) => (
              <div key={review._id} className="bg-white border border-[#D8E1E7] rounded-[18px] p-6 md:p-8 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <h3 className="text-2xl font-bold text-[#10213B]">
                        {review.attractionId?.name || "Unknown attraction"}
                      </h3>
                      <span className="px-3 py-1 bg-[#E6F7F0] text-[#004638] text-sm font-medium rounded-full border border-[#A7D7C5]">
                        {review.attractionId?.category || "Uncategorized"}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < review.rating ? "text-[#FFAB00] text-2xl" : "text-[#D8E1E7] text-2xl"}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-[#65748A] text-base font-medium">
                        {new Date(review.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    
                    <p className="text-[#405066] text-lg leading-relaxed mb-4">
                      {review.reviewText}
                    </p>
                    
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex gap-4 mt-3 flex-wrap">
                        {review.photos.slice(0, 4).map((photo, index) => (
                          <div key={index} className="relative w-28 h-28 rounded-xl overflow-hidden bg-[#CDF5E5] border-2 border-[#D8E1E7] flex-shrink-0 hover:scale-105 transition-transform cursor-pointer shadow-sm">
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
                        {review.photos.length > 4 && (
                          <div className="w-28 h-28 rounded-xl bg-[#F1F6F4] flex items-center justify-center text-[#65748A] text-xl font-medium border-2 border-[#D8E1E7] flex-shrink-0">
                            +{review.photos.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(review)}
                      className="w-11 h-11 flex items-center justify-center border-2 border-[#D8E1E7] text-[#65748A] hover:text-[#006C56] hover:border-[#006C56] rounded-full transition-colors"
                      title="Edit review"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(review)}
                      disabled={isDeleting}
                      className="w-11 h-11 flex items-center justify-center border-2 border-[#D8E1E7] text-[#65748A] hover:text-[#C2413B] hover:border-[#C2413B] rounded-full transition-colors disabled:opacity-50"
                      title="Delete review"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}