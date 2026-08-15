import Attraction from "@/data/models/Attraction";

export async function findAttractions({
  search = "",
  category = "",
  locationArea = "",
  minRating = 0,
  communitySubmitted = false,
  page = 1,
  limit = 15,
}) {
  const query = {
    state: "Melaka",
    isActive: true,
    rating: { $gte: minRating },
  };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  if (category && category !== "All") {
    query.category = category;
  }

  if (locationArea && locationArea !== "All") {
    query.locationArea = locationArea;
  }

  if (communitySubmitted) {
    query.submittedBy = { $exists: true };
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Attraction.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attraction.countDocuments(query),
  ]);

  return { items, total };
}

export async function findAttractionById(attractionId) {
  return Attraction.findOne({
    _id: attractionId,
    state: "Melaka",
    isActive: true,
  }).lean();
}

export async function findAttractionsMissingPhotos({ force = false } = {}) {
  const query = {
    state: "Melaka",
    isActive: true,
  };

  if (!force) {
    query.$or = [{ photos: { $exists: false } }, { photos: { $size: 0 } }];
  }

  return Attraction.find(query)
    .select("_id name googlePlaceId photos")
    .sort({ name: 1 })
    .lean();
}

export async function updateAttractionPhotos(attractionId, photos) {
  return Attraction.findByIdAndUpdate(
    attractionId,
    { $set: { photos } },
    { returnDocument: "after" }
  ).lean();
}

export async function findAllActiveAttractions() {
  return Attraction.find({ state: "Melaka", isActive: true })
    .select("_id name address locationArea")
    .sort({ address: 1 })
    .lean();
}

export async function updateAttractionLocationArea(attractionId, locationArea) {
  return Attraction.findByIdAndUpdate(
    attractionId,
    { $set: { locationArea } },
    { returnDocument: "after" }
  ).lean();
}

export async function findAttractionByIdForRepair(attractionId) {
  return Attraction.findById(attractionId).select("_id name address googlePlaceId").lean();
}

export async function updateAttractionAddress(attractionId, address) {
  return Attraction.findByIdAndUpdate(
    attractionId,
    { $set: { address } },
    { returnDocument: "after" }
  ).lean();
}

export async function findAttractionsMissingDescription({ force = false } = {}) {
  const query = {
    state: "Melaka",
    isActive: true,
  };

  if (!force) {
    query.$or = [{ description: { $exists: false } }, { description: "" }];
  }

  return Attraction.find(query)
    .select("_id name googlePlaceId description")
    .sort({ name: 1 })
    .lean();
}

export async function updateAttractionDescription(attractionId, description) {
  return Attraction.findByIdAndUpdate(
    attractionId,
    { $set: { description } },
    { returnDocument: "after" }
  ).lean();
}

export async function findActiveAttractionByGooglePlaceId(googlePlaceId) {
  return Attraction.findOne({
    googlePlaceId,
    isActive: true,
  }).lean();
}

export async function createAttraction(data) {
  const attraction = await Attraction.create(data);
  return attraction.toObject();
}

export async function addAttractionPhoto(attractionId, photoUrl) {
  return Attraction.findOneAndUpdate(
    { _id: attractionId, isActive: true },
    { $push: { photos: photoUrl } },
    { returnDocument: "after" }
  ).lean();
}
