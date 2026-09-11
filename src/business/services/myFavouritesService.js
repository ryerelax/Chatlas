import {
  countFavouritesByUserId,
  findFavouritesByUserId,
} from "@/data/repositories/favouritesRepository";

export const MY_FAVOURITES_PAGE_SIZE = 9;

export class MyFavouritesServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "MyFavouritesServiceError";
    this.statusCode = statusCode;
  }
}

function normalizePage(value) {
  const page = Math.trunc(Number(value) || 1);
  return Math.max(1, page);
}

function getId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function serializeFavourite(favourite) {
  const attraction = favourite?.attractionId;

  return {
    _id: getId(favourite),
    addedAt: favourite?.addedAt || null,
    attractionId: attraction?._id
      ? {
          _id: getId(attraction),
          name: attraction.name || "",
          category: attraction.category || "",
          address: attraction.address || "",
          rating: Number(attraction.rating) || 0,
          photos: Array.isArray(attraction.photos) ? attraction.photos : [],
        }
      : null,
  };
}

export function createMyFavouritesService({
  countFavourites = countFavouritesByUserId,
  findFavourites = findFavouritesByUserId,
} = {}) {
  return async function getMyFavourites({ userId = "", page = 1 } = {}) {
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    if (!normalizedUserId) {
      throw new MyFavouritesServiceError("User account not found.", 404);
    }

    const total = Number(await countFavourites(normalizedUserId)) || 0;
    const totalPages = Math.max(
      1,
      Math.ceil(total / MY_FAVOURITES_PAGE_SIZE)
    );
    const resolvedPage = Math.min(normalizePage(page), totalPages);
    const favourites = await findFavourites({
      userId: normalizedUserId,
      page: resolvedPage,
      limit: MY_FAVOURITES_PAGE_SIZE,
    });

    return {
      items: (favourites || []).map(serializeFavourite),
      pagination: {
        page: resolvedPage,
        limit: MY_FAVOURITES_PAGE_SIZE,
        total,
        totalPages,
      },
    };
  };
}

export const getMyFavourites = createMyFavouritesService();
