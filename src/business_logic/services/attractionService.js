import mongoose from "mongoose";
import {
  findAttractions,
  findAttractionById,
} from "@/repositories/attractionRepository";

export async function getAttractions({
  search = "",
  category = "",
  minRating = 0,
}) {
  const normalizedSearch = search.trim();
  const normalizedCategory = category.trim();
  const normalizedMinRating = Number(minRating) || 0;

  return findAttractions({
    search: normalizedSearch,
    category: normalizedCategory,
    minRating: normalizedMinRating,
  });
}

export async function getAttractionById(attractionId) {
  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    return null;
  }

  // TODO: Add extra business rules here if attraction visibility rules change.
  return findAttractionById(attractionId);
}