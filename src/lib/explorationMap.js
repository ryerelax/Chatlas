export const MELAKA_MAP_CENTRE = Object.freeze({
  lat: 2.1896,
  lng: 102.2501,
});

function normaliseCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    return null;
  }

  if (coordinate < minimum || coordinate > maximum) {
    return null;
  }

  return coordinate;
}

export function normaliseMapAttractions(attractions) {
  if (!Array.isArray(attractions)) {
    return [];
  }

  return attractions.flatMap((attraction) => {
    const id = attraction?._id?.toString().trim();
    const latitude = normaliseCoordinate(attraction?.latitude, -90, 90);
    const longitude = normaliseCoordinate(attraction?.longitude, -180, 180);

    if (!id || latitude === null || longitude === null) {
      return [];
    }

    const rating = Number(attraction.rating);

    return [
      {
        id,
        name: attraction.name?.trim() || "Unnamed attraction",
        address: attraction.address?.trim() || "Address unavailable",
        category: attraction.category?.trim() || "Attraction",
        latitude,
        longitude,
        rating: Number.isFinite(rating) ? rating : 0,
      },
    ];
  });
}

export function getAttractionDetailsHref(attractionId) {
  return `/attractions/${encodeURIComponent(attractionId)}`;
}
