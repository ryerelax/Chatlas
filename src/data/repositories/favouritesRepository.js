import Attraction from "@/data/models/Attraction";
import Favourite from "@/data/models/Favourite";

export async function countFavouritesByUserId(userId) {
  return Favourite.countDocuments({ userId });
}

export async function findFavouritesByUserId({ userId, page, limit }) {
  return Favourite.find({ userId })
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
