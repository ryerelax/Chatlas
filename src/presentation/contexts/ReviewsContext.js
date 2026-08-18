"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

const ReviewsContext = createContext(null);

export function ReviewsProvider({ children }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState([]);
  const [attractionReviews, setAttractionReviews] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load user's reviews
  const loadReviews = useCallback(async (force = false) => {
    if (!session) return;
    if (loaded && !force) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/reviews/user");
      const data = await res.json();
      if (data.success) {
        setReviews(data.data || []);
        setLoaded(true);
      }
    } catch (err) {
      console.error("Error loading reviews:", err);
    } finally {
      setIsLoading(false);
    }
  }, [session, loaded]);

  // Load reviews for a specific attraction
  const loadAttractionReviews = useCallback(async (attractionId, force = false) => {
    if (!attractionId) return;
    
    // Check if already loaded
    if (attractionReviews[attractionId] && !force) return;

    try {
      const res = await fetch(`/api/reviews?attractionId=${attractionId}`);
      const data = await res.json();
      if (data.success) {
        setAttractionReviews(prev => ({
          ...prev,
          [attractionId]: data.data || []
        }));
      }
    } catch (err) {
      console.error("Error loading attraction reviews:", err);
    }
  }, [attractionReviews]);

  // Delete a review
  const deleteReview = useCallback(async (reviewId) => {
    console.log("=== CONTEXT: deleteReview ===");
    console.log("Review ID:", reviewId);
    
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { 
        method: "DELETE" 
      });
      
      const data = await res.json();
      console.log("Delete API response:", data);
      
      if (data.success) {
        // Remove from user reviews
        setReviews((prev) => prev.filter((r) => r._id !== reviewId));
        
        // Remove from attraction reviews
        setAttractionReviews((prev) => {
          const newState = { ...prev };
          Object.keys(newState).forEach(key => {
            newState[key] = newState[key].filter(r => r._id !== reviewId);
          });
          return newState;
        });
        
        localStorage.setItem('reviewDeleted', 'true');
      } else {
        console.error("Delete failed:", data.message);
      }
      return data;
    } catch (error) {
      console.error("Error deleting review:", error);
      return { success: false, message: error.message };
    }
  }, []);

  // Update a review
  const updateReview = useCallback(async (reviewId, payload) => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (data.success) {
        // Update in user reviews
        setReviews((prev) => prev.map((r) => (r._id === reviewId ? data.data : r)));
        
        // Update in attraction reviews
        setAttractionReviews((prev) => {
          const newState = { ...prev };
          Object.keys(newState).forEach(key => {
            newState[key] = newState[key].map(r => 
              r._id === reviewId ? data.data : r
            );
          });
          return newState;
        });
      }
      return data;
    } catch (error) {
      console.error("Error updating review:", error);
      return { success: false, message: error.message };
    }
  }, []);

  // Refresh all reviews
  const refreshReviews = useCallback(async () => {
    setLoaded(false);
    await loadReviews(true);
  }, [loadReviews]);

  // Refresh attraction reviews
  const refreshAttractionReviews = useCallback(async (attractionId) => {
    if (attractionId) {
      await loadAttractionReviews(attractionId, true);
    }
  }, [loadAttractionReviews]);

  // Add a new review to context
  const addReview = useCallback((newReview) => {
    // Add to user reviews
    setReviews((prev) => [newReview, ...prev]);
    
    // Add to attraction reviews
    if (newReview.attractionId?._id || newReview.attractionId) {
      const attractionId = newReview.attractionId._id || newReview.attractionId;
      setAttractionReviews((prev) => ({
        ...prev,
        [attractionId]: [newReview, ...(prev[attractionId] || [])]
      }));
    }
    
    localStorage.setItem('reviewAdded', 'true');
  }, []);

  // Get all photos from reviews 
  const getPhotos = useCallback(() => {
    const allPhotos = [];
    reviews.forEach((review) => {
      if (review.photos && review.photos.length > 0) {
        review.photos.forEach((photo, index) => {
          allPhotos.push({
            id: `${review._id}-${index}`,
            reviewId: review._id,
            url: photo.url,
            publicId: photo.publicId,
            attractionName: review.attractionId?.name || "Unknown",
            attractionId: review.attractionId?._id || review.attractionId,
            uploadedAt: review.createdAt,
            isProfilePicture: false,
          });
        });
      }
    });
    return allPhotos;
  }, [reviews]);

  // Get photo count 
  const getPhotoCount = useCallback(() => {
    return reviews.reduce((total, review) => {
      return total + (review.photos?.length || 0);
    }, 0);
  }, [reviews]);

  return (
    <ReviewsContext.Provider
      value={{ 
        reviews, 
        attractionReviews,
        isLoading, 
        loaded, 
        loadReviews, 
        loadAttractionReviews,
        deleteReview, 
        updateReview,
        refreshReviews,
        refreshAttractionReviews,
        addReview,
        getPhotos,
        getPhotoCount
      }}
    >
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) throw new Error("useReviews must be used inside ReviewsProvider");
  return ctx;
}

