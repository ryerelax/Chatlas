import Attraction from "@/models/Attraction";

export async function findAttractions({
  search = "",
  category = "",
  minRating = 0,
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