import api from "./api";

// Get user's wishlist
export const getWishlist = async () => {
  try {
    const response = await api.get("/api/collection/wishlist");
    return response.data;
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    throw error;
  }
};

// Add to wishlist
export const addToWishlist = async (attractionId) => {
  try {
    const response = await api.post("/api/collection/wishlist", { attractionId });
    return response.data;
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    throw error;
  }
};

// Remove from wishlist - use query parameter
export const removeFromWishlist = async (attractionId) => {
  try {
    const response = await api.delete(`/api/collection/wishlist?attractionId=${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    throw error;
  }
};

// Check if attraction is in wishlist
export const checkWishlistStatus = async (attractionId) => {
  try {
    const response = await api.get(`/api/collection/wishlist?attractionId=${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error checking wishlist:", error);
    throw error;
  }
};