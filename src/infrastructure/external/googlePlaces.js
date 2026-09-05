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

// Fetches a place's editorial summary. Not every place has one — callers
// should treat undefined/empty as "no description available", not an error.
export async function fetchPlaceEditorialSummary(placeId, apiKey) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "editorialSummary",
    },
  });

  if (!response.ok) {
    throw new Error(`Place Details request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.editorialSummary?.text || "";
}

// Melaka town center, used to bias (not restrict) Autocomplete results toward
// the app's Melaka-only scope.
const MELAKA_LOCATION_BIAS = {
  circle: {
    center: { latitude: 2.1896, longitude: 102.2501 },
    radius: 20000,
  },
};

// Places Text Search (New) - used by the new-attraction-candidate
// investigation and scripts/importNewAttractions.mjs. Unlike Autocomplete,
// this returns full place details (location, types, rating) directly, no
// session token or separate Details call needed.
export async function searchPlacesText(textQuery, { apiKey, maxResultCount = 20 } = {}) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      textQuery,
      locationBias: MELAKA_LOCATION_BIAS,
      maxResultCount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Places Text Search request failed with status ${response.status}`);
  }

  const data = await response.json();

  return (data.places || []).map((place) => ({
    googlePlaceId: place.id,
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    types: place.types || [],
    rating: place.rating || 0,
    totalReviews: place.userRatingCount || 0,
    businessStatus: place.businessStatus || "OPERATIONAL",
    googleMapsUrl: place.googleMapsUri || "",
  }));
}

// Places Autocomplete (New) for Decision 4's "Add Attraction" search. The
// sessionToken must be the same value across every keystroke of one search,
// and again on the following fetchPlaceDetailsForSubmission call, so Google
// bills the whole search-to-selection journey as a single session.
export async function searchPlacesAutocomplete(input, { apiKey, sessionToken } = {}) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input,
      sessionToken,
      locationBias: MELAKA_LOCATION_BIAS,
    }),
  });

  if (!response.ok) {
    throw new Error(`Places Autocomplete request failed with status ${response.status}`);
  }

  const data = await response.json();

  return (data.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      placeId: prediction.placeId,
      text: prediction.text?.text || "",
    }));
}

// Fetches full place details for a place the user selected from Autocomplete
// results, closing the Autocomplete session by reusing the same sessionToken.
// Used only by the Add Attraction submission flow (Decision 4) — distinct
// from fetchPlaceFormattedAddress/fetchPlaceEditorialSummary, which serve the
// offline sync scripts and only fetch one field at a time.
export async function fetchPlaceDetailsForSubmission(placeId, { apiKey, sessionToken } = {}) {
  if (!apiKey) {
    throw new Error("Google Places API key is not configured.");
  }

  const url = new URL(`${PLACES_API_BASE}/places/${placeId}`);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "id,displayName,formattedAddress,location,types,rating,userRatingCount,businessStatus,googleMapsUri",
    },
  });

  if (!response.ok) {
    throw new Error(`Place Details request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    googlePlaceId: data.id,
    name: data.displayName?.text || "",
    address: data.formattedAddress || "",
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
    types: data.types || [],
    rating: data.rating || 0,
    totalReviews: data.userRatingCount || 0,
    businessStatus: data.businessStatus || "OPERATIONAL",
    googleMapsUrl: data.googleMapsUri || "",
  };
}
