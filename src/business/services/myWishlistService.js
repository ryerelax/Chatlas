import {
  countWishlistItemsByUserId,
  findWishlistItemsByUserId,
} from "@/data/repositories/wishlistRepository";

export const MY_WISHLIST_PAGE_SIZE = 9;

export class MyWishlistServiceError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "MyWishlistServiceError";
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

function serializeWishlistItem(item) {
  const attraction = item?.attractionId;

  return {
    _id: getId(item),
    addedAt: item?.addedAt || null,
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

export function createMyWishlistService({
  countWishlistItems = countWishlistItemsByUserId,
  findWishlistItems = findWishlistItemsByUserId,
} = {}) {
  return async function getMyWishlist({ userId = "", page = 1 } = {}) {
    const normalizedUserId = typeof userId === "string" ? userId.trim() : "";
    if (!normalizedUserId) {
      throw new MyWishlistServiceError("User account not found.", 404);
    }

    const total = Number(await countWishlistItems(normalizedUserId)) || 0;
    const totalPages = Math.max(1, Math.ceil(total / MY_WISHLIST_PAGE_SIZE));
    const resolvedPage = Math.min(normalizePage(page), totalPages);
    const wishlistItems = await findWishlistItems({
      userId: normalizedUserId,
      page: resolvedPage,
      limit: MY_WISHLIST_PAGE_SIZE,
    });

    return {
      items: (wishlistItems || []).map(serializeWishlistItem),
      pagination: {
        page: resolvedPage,
        limit: MY_WISHLIST_PAGE_SIZE,
        total,
        totalPages,
      },
    };
  };
}

export const getMyWishlist = createMyWishlistService();
