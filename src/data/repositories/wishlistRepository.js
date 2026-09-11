import Attraction from "@/data/models/Attraction";
import WishlistItem from "@/data/models/WishlistItem";

export async function countWishlistItemsByUserId(userId) {
  return WishlistItem.countDocuments({ userId });
}

export async function findWishlistItemsByUserId({ userId, page, limit }) {
  return WishlistItem.find({ userId })
    .populate({
      path: "attractionId",
      model: Attraction,
      select: "name category address rating photos",
    })
    .sort({ addedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
}
