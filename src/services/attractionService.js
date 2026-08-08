import mongoose from "mongoose";
import {
  findAttractions,
  findAttractionById,
} from "@/repositories/attractionRepository";

const PAGE_SIZE = 15;

export async function getAttractions({
  search = "",
  category = "",
  minRating = 0,
  page = 1,
}) {
  const normalizedSearch = search.trim();
  const normalizedCategory = category.trim();
  const normalizedMinRating = Number(minRating) || 0;
  const normalizedPage = Math.max(1, Number(page) || 1);

  const { items, total } = await findAttractions({
    search: normalizedSearch,
    category: normalizedCategory,
    minRating: normalizedMinRating,
    page: normalizedPage,
    limit: PAGE_SIZE,
  });

  return {
    items,
    total,
    page: normalizedPage,
    limit: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getAttractionById(attractionId) {
  if (!mongoose.Types.ObjectId.isValid(attractionId)) {
    return null;
  }

  // TODO: Add extra business rules here if attraction visibility rules change.
  return findAttractionById(attractionId);
}