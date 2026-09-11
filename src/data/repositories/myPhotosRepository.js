import mongoose from "mongoose";
import Attraction from "@/data/models/Attraction";
import Review from "@/data/models/Review";

function toObjectId(userId) {
  return userId instanceof mongoose.Types.ObjectId
    ? userId
    : new mongoose.Types.ObjectId(userId);
}

function validPhotoStages(userId) {
  return [
    { $match: { userId: toObjectId(userId) } },
    { $unwind: { path: "$photos", includeArrayIndex: "photoIndex" } },
    {
      $match: {
        "photos.url": { $type: "string", $ne: "" },
        "photos.publicId": { $type: "string", $ne: "" },
      },
    },
  ];
}

export async function countUniqueReviewPhotosByUserId(userId) {
  const [result] = await Review.aggregate([
    ...validPhotoStages(userId),
    { $group: { _id: "$photos.url" } },
    { $count: "total" },
  ]);

  return Number(result?.total) || 0;
}

export async function findReviewPhotosByUserId({ userId, page, limit }) {
  const skip = (page - 1) * limit;

  return Review.aggregate([
    ...validPhotoStages(userId),
    { $sort: { createdAt: -1, _id: -1, photoIndex: 1 } },
    {
      $group: {
        _id: "$photos.url",
        reviewId: { $first: "$_id" },
        attractionId: { $first: "$attractionId" },
        url: { $first: "$photos.url" },
        publicId: { $first: "$photos.publicId" },
        uploadedAt: { $first: "$createdAt" },
        photoIndex: { $first: "$photoIndex" },
      },
    },
    { $sort: { uploadedAt: -1, reviewId: -1, photoIndex: 1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: Attraction.collection.name,
        localField: "attractionId",
        foreignField: "_id",
        as: "attraction",
      },
    },
    {
      $set: {
        attractionName: {
          $ifNull: [{ $arrayElemAt: ["$attraction.name", 0] }, "Unknown attraction"],
        },
      },
    },
    { $project: { attraction: 0 } },
  ]);
}

export async function findReviewPhotoByUrl({ userId, url }) {
  if (!url) return null;

  const review = await Review.findOne({ userId, "photos.url": url })
    .select("_id attractionId photos createdAt")
    .populate("attractionId", "_id name")
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  if (!review) return null;
  const photoIndex = review.photos.findIndex((photo) => photo?.url === url);
  const photo = review.photos[photoIndex];
  if (!photo?.url || !photo?.publicId) return null;

  return {
    reviewId: review._id,
    attractionId: review.attractionId?._id || review.attractionId,
    attractionName: review.attractionId?.name || "Unknown attraction",
    url: photo.url,
    publicId: photo.publicId,
    uploadedAt: review.createdAt,
    photoIndex,
  };
}

export async function findOwnedReviewPhotoByPublicId({ userId, publicId }) {
  if (!publicId) return null;

  const review = await Review.findOne({
    userId,
    "photos.publicId": publicId,
  })
    .select("photos")
    .lean();

  const photo = review?.photos?.find(
    (candidate) => candidate?.publicId === publicId
  );

  if (!photo?.url || !photo?.publicId) return null;
  return { url: photo.url, publicId: photo.publicId };
}
