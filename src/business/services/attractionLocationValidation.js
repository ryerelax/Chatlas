import { isMelakaLocation } from "@/business/services/locationGate";

// Melaka state's approximate geographic extent — a generous bounding box,
// not a precise administrative boundary, so real attractions near the
// state's edges (Alor Gajah, Jasin) aren't falsely rejected. This is a
// secondary sanity check alongside the address-text match below: Google
// Places' locationBias on Autocomplete only nudges results toward Melaka,
// it doesn't restrict them, so a user can still select a place anywhere in
// the world and reach submission with it.
const MELAKA_BOUNDS = {
  minLatitude: 2.0,
  maxLatitude: 2.55,
  minLongitude: 101.95,
  maxLongitude: 102.6,
};

export function isWithinMelakaCoordinates(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  return (
    latitude >= MELAKA_BOUNDS.minLatitude &&
    latitude <= MELAKA_BOUNDS.maxLatitude &&
    longitude >= MELAKA_BOUNDS.minLongitude &&
    longitude <= MELAKA_BOUNDS.maxLongitude
  );
}

// True only when BOTH the authoritative address text and coordinates from
// Google Place Details indicate the place is in Melaka.
export function isMelakaPlace({ address, latitude, longitude } = {}) {
  return isMelakaLocation(address) && isWithinMelakaCoordinates(latitude, longitude);
}
