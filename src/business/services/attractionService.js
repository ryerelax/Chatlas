import mongoose from "mongoose";
import {
  findAttractions,
  findAttractionById,
} from "@/data/repositories/attractionRepository";

const PAGE_SIZE = 15;

export function createAttractionService({
  findAttractions: findAttractionsForService,
  findAttractionById: findAttractionByIdForService,
  isValidObjectId,
}) {
  return {
    async getAttractions({
      search = "",
      category = "",
      locationArea = "",
      minRating = 0,
      page = 1,
    }) {
      const normalizedSearch = search.trim();
      const normalizedCategory = category.trim();
      const normalizedLocationArea = locationArea.trim();
      const normalizedMinRating = Number(minRating) || 0;
      const normalizedPage = Math.max(1, Number(page) || 1);
      const { items, total } = await findAttractionsForService({
        search: normalizedSearch,
        category: normalizedCategory,
        locationArea: normalizedLocationArea,
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
    },
    async getAttractionById(attractionId) {
      if (!isValidObjectId(attractionId)) {
        return null;
      }

      // TODO: Add extra business rules here if attraction visibility rules change.
      return findAttractionByIdForService(attractionId);
    },
  };
}

const attractionService = createAttractionService({
  findAttractions,
  findAttractionById,
  isValidObjectId: mongoose.Types.ObjectId.isValid,
});

export async function getAttractions(options) {
  return attractionService.getAttractions(options);
}

export async function getAttractionById(attractionId) {
  return attractionService.getAttractionById(attractionId);
}
