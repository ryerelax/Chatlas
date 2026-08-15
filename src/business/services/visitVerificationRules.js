export const MAX_VISIT_DISTANCE_METRES = 150;
export const MAX_GEOLOCATION_ACCURACY_METRES = 100;
export const MAX_PHOTOS_PER_ATTRACTION_DAY = 3;
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

const EARTH_RADIUS_METRES = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function calculateDistanceMetres(origin, destination) {
  const lat1 = toRadians(Number(origin.latitude));
  const lat2 = toRadians(Number(destination.latitude));
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(Number(destination.longitude) - Number(origin.longitude));
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateGeolocationEvidence({ latitude, longitude, accuracyMeters }) {
  const evidence = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracyMeters: Number(accuracyMeters),
  };

  if (!Number.isFinite(evidence.latitude) || evidence.latitude < -90 || evidence.latitude > 90
      || !Number.isFinite(evidence.longitude) || evidence.longitude < -180 || evidence.longitude > 180) {
    throw new Error("A valid current location is required.");
  }

  if (!Number.isFinite(evidence.accuracyMeters)
      || evidence.accuracyMeters < 0
      || evidence.accuracyMeters > MAX_GEOLOCATION_ACCURACY_METRES) {
    throw new Error("Location accuracy must be 100 metres or better.");
  }

  return evidence;
}

export function findNearbyAttractions(attractions, position) {
  const validPosition = validateGeolocationEvidence(position);

  return attractions
    .map((attraction) => ({
      attraction,
      distanceMetres: calculateDistanceMetres(validPosition, attraction),
    }))
    .filter(({ distanceMetres }) => Number.isFinite(distanceMetres)
      && distanceMetres <= MAX_VISIT_DISTANCE_METRES)
    .sort((first, second) => first.distanceMetres - second.distanceMetres);
}

export function createMalaysiaVisitDateKey(date) {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partValue = (type) => dateParts.find((part) => part.type === type).value;

  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}
