import mongoose from "mongoose";
import {
  findAttractions,
  findAttractionById,
} from "@/data/repositories/attractionRepository";

export async function getAttractions({
  search = "",
  category = "",
  minRating = 0,
} = {}) {
  const normalizedSearch = String(search).trim();
  const normalizedCategory = String(category).trim();
  const normalizedMinRating = Math.max(Number(minRating) || 0, 0);

  return findAttractions({
    search: normalizedSearch,
    category: normalizedCategory,
    minRating: normalizedMinRating,
  });
}

export async function getAttractionById(attractionId) {
  const normalizedAttractionId = String(attractionId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(normalizedAttractionId)) {
    return null;
  }

  // TODO: Add additional attraction visibility rules if inactive,
  // archived, or restricted attractions require different access behaviour.
  return findAttractionById(normalizedAttractionId);
}