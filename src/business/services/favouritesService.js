import api from "./api";

// Get user's favourites
export const getFavourites = async () => {
  try {
    const response = await api.get("/api/collection/favourites");
    return response.data;
  } catch (error) {
    console.error("Error fetching favourites:", error);
    throw error;
  }
};

// Add to favourites
export const addToFavourites = async (attractionId) => {
  try {
    const response = await api.post("/api/collection/favourites", { attractionId });
    return response.data;
  } catch (error) {
    console.error("Error adding to favourites:", error);
    throw error;
  }
};

// Remove from favourites
export const removeFromFavourites = async (attractionId) => {
  try {
    const response = await api.delete(`/api/collection/favourites/${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error removing from favourites:", error);
    throw error;
  }
};

// Check if attraction is in favourites
export const checkFavouritesStatus = async (attractionId) => {
  try {
    const response = await api.get(`/api/collection/favourites?attractionId=${attractionId}`);
    return response.data;
  } catch (error) {
    console.error("Error checking favourites:", error);
    throw error;
  }
};