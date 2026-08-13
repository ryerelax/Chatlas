import api from "./api";

export const getWishlist = async () => {
  try {
    const response = await api.get("/api/collection/wishlist");
    return response.data;
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    throw error;
  }
};

export const addToWishlist = async (attractionId) => {
  try {
    const response = await api.post("/api/collection/wishlist", { attractionId });
    return response.data;
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    throw error;
  }
};

export const removeFromWishlist = async (attractionId) => {
  try {
    const response = await api.delete(`/api/collection/wishlist/${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    throw error;
  }
};

export const checkWishlistStatus = async (attractionId) => {
  try {
    const response = await api.get(`/api/collection/wishlist/check/${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error checking wishlist:", error);
    throw error;
  }
};