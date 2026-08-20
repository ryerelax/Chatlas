import Attraction from "@/data/models/Attraction";

const EXPLORATION_MAP_FIELDS =
  "_id name address latitude longitude category rating totalReviews businessStatus";

export function createExplorationMapAttractionsRepository(AttractionModel) {
  return {
    findAllActiveMelakaMapAttractions() {
      return AttractionModel.find({ state: "Melaka", isActive: true })
        .select(EXPLORATION_MAP_FIELDS)
        .sort({ name: 1, _id: 1 })
        .lean();
    },
  };
}

const explorationMapAttractionsRepository =
  createExplorationMapAttractionsRepository(Attraction);

export async function findAllActiveMelakaMapAttractions() {
  return explorationMapAttractionsRepository.findAllActiveMelakaMapAttractions();
}

// Sorts findAttractions can apply directly in MongoDB, since the field
// already lives on the document. "rating" and "mostReviewed" are NOT here -
// combinedRating and chatlasReviewCount only exist after attractionService
// joins in Review stats per attraction, so those sorts happen there instead
// (see getAttractions) and this repository returns every filtered match
// unpaginated for the service to sort and slice.
const DB_SORTS = {
  name: { name: 1 },
  newest: { createdAt: -1 },
};

export async function findAttractions({
  search = "",
  category = "",
  locationArea = "",
  minRating = 0,
  communitySubmitted = false,
  page = 1,
  limit = 15,
  sort = "name",
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

  const dbSort = DB_SORTS[sort];

  if (dbSort) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Attraction.find(query).sort(dbSort).skip(skip).limit(limit).lean(),
      Attraction.countDocuments(query),
    ]);

    return { items, total };
  }

  const [items, total] = await Promise.all([
    Attraction.find(query).sort(DB_SORTS.name).lean(),
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
    .select("_id name googlePlaceId description latitude longitude category locationArea")
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

// Shared by the Wikidata and generic-template description backfills - both
// need the same descriptionLastEditedBy: { $exists: false } guard so a
// re-run never overwrites a description a community member has since
// edited via the wiki-style editing feature (matching returns null).
function updateAttractionDescriptionWithSource(attractionId, description, descriptionSource) {
  return Attraction.findOneAndUpdate(
    { _id: attractionId, isActive: true, descriptionLastEditedBy: { $exists: false } },
    { $set: { description, descriptionSource } },
    { returnDocument: "after" }
  ).lean();
}

// scripts/backfillWikidataDescriptions.mjs
export async function updateAttractionDescriptionFromWikidata(attractionId, description) {
  return updateAttractionDescriptionWithSource(attractionId, description, "wikidata");
}

// scripts/backfillGenericDescriptions.mjs - template-based fallback for
// attractions no Wikidata match covered. Never gets the "Source: Wikipedia"
// caption (that checks descriptionSource === "wikidata" specifically).
export async function updateAttractionDescriptionGeneric(attractionId, description) {
  return updateAttractionDescriptionWithSource(attractionId, description, "generic");
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

// Community description edit (Melaka-gated, distinct from
// updateAttractionDescription above, which is the sync:descriptions
// script's own automated Places-backfill path and must not carry an
// editor snapshot).
export async function updateAttractionDescriptionByUser(attractionId, description, editedBy) {
  return Attraction.findOneAndUpdate(
    { _id: attractionId, isActive: true },
    { $set: { description, descriptionLastEditedBy: editedBy } },
    { returnDocument: "after" }
  ).lean();
}
