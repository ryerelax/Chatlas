"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useReviews } from "@/presentation/contexts/ReviewsContext";

export default function MyPhotosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { reviews, loadReviews, refreshReviews } = useReviews();
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?redirect=/photos");
      return;
    }
    
    if (status === "authenticated") {
      loadReviews(true);
    }
  }, [status, router, loadReviews]);

  // Extract photos from reviews whenever reviews change
  useEffect(() => {
    if (reviews.length > 0 || !isLoading) {
      extractPhotosFromReviews();
    }
  }, [reviews]);

  // Auto-refresh when coming back to the page
  useEffect(() => {
    const refreshIfNeeded = () => {
      if (localStorage.getItem('reviewAdded') === 'true') {
        localStorage.removeItem('reviewAdded');
        console.log("Refreshing photos page after review added...");
        refreshReviews();
      }
      if (localStorage.getItem('reviewDeleted') === 'true') {
        localStorage.removeItem('reviewDeleted');
        console.log("Refreshing photos page after review deleted...");
        refreshReviews();
      }
      if (localStorage.getItem('photoDeleted') === 'true') {
        localStorage.removeItem('photoDeleted');
        console.log("Refreshing photos page after photo deleted...");
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

  const extractPhotosFromReviews = () => {
    setIsLoading(true);
    try {
      const photoList = [];
      
      reviews.forEach((review) => {
        if (review.photos && review.photos.length > 0) {
          review.photos.forEach((photo, index) => {
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
              isProfilePicture: false,
            });
          });
        }
      });

      // TODO: Set profile picture from user data when API is ready
      // For now, mark first photo as profile if exists
      if (photoList.length > 0 && !photoList.some(p => p.isProfilePicture)) {
        photoList[0].isProfilePicture = true;
      }

      setPhotos(photoList);
    } catch (error) {
      console.error("Error extracting photos:", error);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSetProfile = (photoId) => {
    setPhotos(photos.map((p) => ({ 
      ...p, 
      isProfilePicture: p.id === photoId 
    })));
    showToast("Profile picture updated successfully");
    
    // TODO: Call API to update user profile picture when your teammate adds it
    // await fetch("/api/user/profile-picture", {
    //   method: "PUT",
    //   body: JSON.stringify({ photoUrl: photo.url, publicId: photo.publicId })
    // });
  };

  const handleDeletePhoto = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      // Call API to delete photo from review
      const response = await fetch(`/api/reviews/${deleteTarget.reviewId}/photos`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          publicId: deleteTarget.publicId,
          url: deleteTarget.url 
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove from UI
        setPhotos(photos.filter((p) => p.id !== deleteTarget.id));
        setDeleteTarget(null);
        localStorage.setItem('photoDeleted', 'true');
        showToast("Photo deleted successfully");
        
        // Refresh reviews to sync with database
        await refreshReviews();
      } else {
        showToast(data.message || "Failed to delete photo", "error");
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
      showToast("Failed to delete photo", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-[#65748A]">Loading your photos...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const profilePic = photos.find((p) => p.isProfilePicture);

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* Hero */}
      <div className="bg-[#006C56] text-white py-12 px-4">
        <div className="max-w-[1200px] mx-auto">
          <button
            onClick={() => router.push("/profile")}
            className="text-white/80 hover:text-white mb-4 flex items-center gap-2 transition-colors"
          >
            ← Back to Profile
          </button>
          <h1 className="text-3xl md:text-4xl font-bold">My Photos</h1>
          <p className="text-white/80 mt-2">
            {photos.length === 0 
              ? "No photos uploaded yet" 
              : `Showing ${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-[#98A2B3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-[#10213B]">No photos yet</h3>
            <p className="text-[#65748A] mt-2">You haven't uploaded any photos with your reviews yet.</p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 px-6 py-2 bg-[#FFAB00] text-[#142033] font-semibold rounded-lg hover:bg-[#E89B00] transition-colors"
            >
              Explore Attractions
            </button>
          </div>
        ) : (
          <>
            {/* Current profile picture callout */}
            {profilePic && (
              <div className="flex items-center gap-4 bg-white border border-[#D8E1E7] p-4 mb-6 rounded-[14px]">
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#006C56] bg-[#CDF5E5]">
                  {profilePic.url ? (
                    <Image src={profilePic.url} alt="Profile" width={64} height={64} className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#006C56]/50 text-xs">No img</div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[#10213B]">Current profile picture</p>
                  <p className="text-[#65748A] text-sm">{profilePic.attractionName} · {profilePic.uploadedAt}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative overflow-hidden cursor-pointer bg-[#CDF5E5] rounded-xl aspect-square group"
                  onClick={() => setLightboxPhoto(photo)}
                >
                  {photo.url ? (
                    <Image src={photo.url} alt={photo.attractionName} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#006C56]/30 text-sm">No photo</div>
                  )}
                  
                  {photo.isProfilePicture && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-[#FFAB00] text-[#142033] text-xs font-medium rounded-md">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 3l3.057-3 11.943 12-11.943 12-3.057-3 9-9z" />
                      </svg>
                      Profile
                    </div>
                  )}
                  
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setLightboxPhoto(photo)}
                      className="px-3 py-1.5 bg-white/90 text-[#10213B] text-xs font-medium rounded-md hover:bg-white transition-colors"
                    >
                      View
                    </button>
                    {!photo.isProfilePicture && (
                      <button
                        onClick={() => handleSetProfile(photo.id)}
                        className="px-3 py-1.5 bg-[#FFAB00] text-[#142033] text-xs font-medium rounded-md hover:bg-[#E89B00] transition-colors"
                      >
                        Set as profile
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(photo)}
                      disabled={isDeleting}
                      className="px-3 py-1.5 bg-[#C2413B] text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/55 to-transparent">
                    <p className="text-white text-xs font-medium truncate">{photo.attractionName}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative max-w-3xl w-full rounded-[14px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxPhoto.url ? (
              <Image
                src={lightboxPhoto.url}
                alt={lightboxPhoto.attractionName}
                width={1200}
                height={800}
                className="w-full object-contain max-h-[80vh]"
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center bg-[#CDF5E5] text-[#006C56]/50">
                No image available
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-white font-semibold">{lightboxPhoto.attractionName}</p>
              <p className="text-white/70 text-sm">{lightboxPhoto.uploadedAt}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="bg-white w-full max-w-md rounded-[18px] p-6">
            <h3 className="text-xl font-bold text-[#10213B]">Delete this photo?</h3>
            <p className="text-[#65748A] mt-2">Are you sure you want to permanently delete this photo? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 border border-[#BBC8D0] text-[#004638] font-semibold rounded-lg hover:bg-[#F1F6F4] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePhoto}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-[#C2413B] text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete photo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg font-medium shadow-lg z-50 ${
          toast.type === "error" ? "bg-[#C2413B] text-white" : "bg-[#16845B] text-white"
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}