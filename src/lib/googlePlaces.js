const PLACES_API_BASE = "https://places.googleapis.com/v1";

async function fetchPhotoNames(placeId, apiKey) {
  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });

  if (!response.ok) {
    throw new Error(`Place Details request failed with status ${response.status}`);
  }

  const data = await response.json();
  return (data.photos || []).map((photo) => photo.name);
}

async function resolvePhotoUri(photoName, apiKey, maxWidthPx) {
  const response = await fetch(
    `${PLACES_API_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Place Photo media request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.photoUri;
}

// Resolves a Google place to a list of directly-fetchable photo image URLs.
// These URLs are short-lived, so callers must hand them off (e.g. to Cloudinary)
// immediately rather than storing them.
export async function fetchPlacePhotoUrls(placeId, { apiKey, maxPhotos = 6, maxWidthPx = 1600 } = {}) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const photoNames = (await fetchPhotoNames(placeId, apiKey)).slice(0, maxPhotos);

  const photoUrls = [];
  for (const photoName of photoNames) {
    const uri = await resolvePhotoUri(photoName, apiKey, maxWidthPx);
    if (uri) {
      photoUrls.push(uri);
    }
  }

  return photoUrls;
}

// Re-fetches the authoritative formatted address for a place. Used to repair
// records whose stored `address` doesn't match their `googlePlaceId`/coordinates
// (see scripts/fixAttractionAddress.mjs).
export async function fetchPlaceFormattedAddress(placeId, apiKey) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "formattedAddress",
    },
  });

  if (!response.ok) {
    throw new Error(`Place Details request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.formattedAddress;
}
