import {
  createDevelopmentVisitedAttractionCollection,
  normaliseVisitedAttractionIds,
  selectDevelopmentPreviewVisitedAttractionIds,
  VISITED_DATA_STATUS,
} from "@/business/services/explorationMapService";

const AUTH_REQUIRED_MESSAGE = "Sign in to view your verified visits.";
const LOAD_ERROR_MESSAGE = "Verified visits could not be loaded.";
const DEVELOPMENT_PREVIEW_MESSAGE =
  "Development preview \u2014 mock visited data";
const DEVELOPMENT_LOADING_PREVIEW_MESSAGE =
  "Development preview \u2014 visited data loading";
const DEVELOPMENT_VISITED_PREVIEW_MODES = new Set([
  "visited",
  "empty",
  "loading",
]);
const DEVELOPMENT_MAP_PREVIEW_MODES = new Set([
  "loading",
  "unavailable",
]);

export function getDevelopmentVisitedPreviewMode(
  queryString,
  runtimeEnvironment
) {
  if (
    runtimeEnvironment !== "development" ||
    typeof queryString !== "string"
  ) {
    return null;
  }

  const queryValue = new URLSearchParams(queryString).get(
    "previewVisited"
  );
  const mode = queryValue === "1" ? "visited" : queryValue;

  return DEVELOPMENT_VISITED_PREVIEW_MODES.has(mode) ? mode : null;
}

export function getDevelopmentMapPreviewMode(
  queryString,
  runtimeEnvironment
) {
  if (
    runtimeEnvironment !== "development" ||
    typeof queryString !== "string"
  ) {
    return null;
  }

  const mode = new URLSearchParams(queryString).get("previewMap");

  return DEVELOPMENT_MAP_PREVIEW_MODES.has(mode) ? mode : null;
}

export function isDevelopmentVisitedPreviewEnabled(
  queryString,
  runtimeEnvironment
) {
  return (
    getDevelopmentVisitedPreviewMode(
      queryString,
      runtimeEnvironment
    ) === "visited"
  );
}

/**
 * Loads the attraction IDs verified as visited by the signed-in user.
 *
 * The adapter keeps private visited-data access separate from the public map UI.
 * User identity is intentionally not accepted here because the route resolves
 * it from the server-side session.
 *
 * @param {{
 *   signal?: AbortSignal,
 *   fetchImpl?: typeof fetch,
 *   developmentPreview?: boolean,
 *   previewAttractionIds?: unknown[],
 * }} options
 * @returns {Promise<{
 *   status: "success" | "auth-required" | "error",
 *   data: string[],
 *   message: string,
 * }>}
 */
export async function loadVisitedAttractionIds({
  signal,
  fetchImpl = globalThis.fetch,
  developmentPreview = false,
  previewAttractionIds = [],
} = {}) {
  if (
    process.env.NODE_ENV === "development" &&
    developmentPreview === true
  ) {
    return {
      status: VISITED_DATA_STATUS.SUCCESS,
      data: normaliseVisitedAttractionIds(previewAttractionIds),
      message: DEVELOPMENT_PREVIEW_MESSAGE,
    };
  }

  let response;
  try {
    response = await fetchImpl("/api/exploration-map/verified-visits", {
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(LOAD_ERROR_MESSAGE);
  }

  if (response?.status === 401) {
    return {
      status: VISITED_DATA_STATUS.AUTH_REQUIRED,
      data: [],
      message: AUTH_REQUIRED_MESSAGE,
    };
  }

  let result;
  try {
    result = await response?.json();
  } catch {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  if (
    !response?.ok ||
    result?.success === false ||
    !Array.isArray(result?.data)
  ) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  // TODO: Refresh this adapter after Verified Visit create or delete actions are added to the map.
  return {
    status: VISITED_DATA_STATUS.SUCCESS,
    data: normaliseVisitedAttractionIds(result.data),
    message: "",
  };
}

export function createDevelopmentVisitedPreviewAdapter({
  supportedAttractions = [],
  mode = "visited",
} = {}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const resolvedMode = DEVELOPMENT_VISITED_PREVIEW_MODES.has(mode)
    ? mode
    : "visited";
  const initialAttractionIds =
    resolvedMode === "visited"
      ? selectDevelopmentPreviewVisitedAttractionIds(
          supportedAttractions
        )
      : [];
  const visitedAttractionCollection =
    createDevelopmentVisitedAttractionCollection(
      supportedAttractions,
      initialAttractionIds
    );

  function createResult(signal) {
    if (resolvedMode === "loading") {
      return Promise.resolve({
        status: VISITED_DATA_STATUS.LOADING,
        data: [],
        message: DEVELOPMENT_LOADING_PREVIEW_MESSAGE,
      });
    }

    return loadVisitedAttractionIds({
      signal,
      developmentPreview: true,
      previewAttractionIds: visitedAttractionCollection.getAttractionIds(),
    });
  }

  return Object.freeze({
    load({ signal } = {}) {
      return createResult(signal);
    },
    add({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      visitedAttractionCollection.add();
      return createResult(signal);
    },
    remove({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      visitedAttractionCollection.remove();
      return createResult(signal);
    },
    reset({ signal } = {}) {
      if (resolvedMode !== "visited") {
        return createResult(signal);
      }

      visitedAttractionCollection.reset();
      return createResult(signal);
    },
  });
}
