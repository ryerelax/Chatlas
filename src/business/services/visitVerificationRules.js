export const MAX_GEOLOCATION_ACCURACY_METRES = 30;
export const MAX_PHOTOS_PER_ATTRACTION_DAY = 1;
export const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

const EARTH_RADIUS_METRES = 6371000;
const DISTANCE_FLOATING_POINT_TOLERANCE_METRES = 0.0000001;
const DEFAULT_VERIFICATION_RADIUS_METRES = 50;
const MIN_VERIFICATION_RADIUS_METRES = 30;
const MAX_VERIFICATION_RADIUS_METRES = 150;
const VERIFIED_VISIT_SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;
const CATEGORY_VERIFICATION_RADIUS_METRES = Object.freeze({
  restaurant: 30,
  cafe: 30,
  food: 30,
  "small shop": 30,
  "small monument": 30,
  museum: 50,
  historical: 50,
  cultural: 50,
  religious: 50,
  architecture: 50,
  gallery: 50,
  landmark: 50,
  "tourist attraction": 50,
  entertainment: 75,
  market: 75,
  "shopping mall": 75,
  "indoor attraction": 75,
  "recreation centre": 75,
  waterfront: 75,
  nature: 100,
  park: 100,
  garden: 100,
  beach: 100,
  zoo: 100,
  "theme park": 100,
  resort: 100,
  "large complex": 100,
  "tourism district": 150,
  "heritage district": 150,
  "river walk": 150,
  "jonker walk": 150,
});

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function calculateDistanceMetres(origin, destination) {
  const lat1 = toRadians(Number(origin.latitude));
  const lat2 = toRadians(Number(destination.latitude));
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(Number(destination.longitude) - Number(origin.longitude));
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const clampedA = Math.min(1, Math.max(0, a));

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
}

export function normalizeVerificationCategory(category) {
  return typeof category === "string"
    ? category.trim().replace(/\s+/gu, " ").toLowerCase()
    : "";
}

export function resolveVerificationRadiusMeters(attraction) {
  const override = attraction?.verificationRadiusMeters;
  if (
    Number.isInteger(override)
    && override >= MIN_VERIFICATION_RADIUS_METRES
    && override <= MAX_VERIFICATION_RADIUS_METRES
  ) {
    return override;
  }

  const category = normalizeVerificationCategory(attraction?.category);
  return CATEGORY_VERIFICATION_RADIUS_METRES[category]
    ?? DEFAULT_VERIFICATION_RADIUS_METRES;
}

export function isWithinVisitDistance(distanceMetres, radiusMeters) {
  return Number.isFinite(distanceMetres)
    && Number.isFinite(radiusMeters)
    && distanceMetres <= radiusMeters + DISTANCE_FLOATING_POINT_TOLERANCE_METRES;
}

function formatAccuracyMeters(accuracyMeters) {
  return accuracyMeters.toString();
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

  if (!Number.isFinite(evidence.accuracyMeters) || evidence.accuracyMeters < 0) {
    throw new Error("A valid location accuracy is required.");
  }

  if (evidence.accuracyMeters > MAX_GEOLOCATION_ACCURACY_METRES) {
    throw new Error(
      `Location accuracy is currently ${formatAccuracyMeters(evidence.accuracyMeters)} metres. Move outdoors and try again. Accuracy must be within 30 metres.`
    );
  }

  return evidence;
}

export function evaluateVisitProximity(attraction, position) {
  const distanceMetres = calculateDistanceMetres(position, attraction);
  const radiusMeters = resolveVerificationRadiusMeters(attraction);

  return {
    attraction,
    distanceMetres,
    radiusMeters,
    qualifies: isWithinVisitDistance(distanceMetres, radiusMeters),
  };
}

function evaluateAttractions(attractions, position) {
  return attractions
    .filter((attraction) => attraction && typeof attraction === "object")
    .map((attraction) => evaluateVisitProximity(attraction, position))
    .filter(({ distanceMetres }) => Number.isFinite(distanceMetres));
}

export function findNearbyAttractions(attractions, position) {
  const validPosition = validateGeolocationEvidence(position);

  return evaluateAttractions(attractions, validPosition)
    .filter(({ qualifies }) => qualifies)
    .sort((first, second) => first.distanceMetres - second.distanceMetres);
}

export function findNearestToQualifyingAttraction(attractions, position) {
  const validPosition = validateGeolocationEvidence(position);

  return evaluateAttractions(attractions, validPosition)
    .sort((first, second) => {
      const firstGap = Math.max(0, first.distanceMetres - first.radiusMeters);
      const secondGap = Math.max(0, second.distanceMetres - second.radiusMeters);
      return firstGap - secondGap || first.distanceMetres - second.distanceMetres;
    })[0] ?? null;
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

export function normaliseVerifiedVisitSubmissionKey(value) {
  if (value === undefined || value === null) return undefined;

  if (
    typeof value !== "string"
    || !VERIFIED_VISIT_SUBMISSION_KEY_PATTERN.test(value)
  ) {
    throw new Error("A valid submission key is required.");
  }

  return value;
}
